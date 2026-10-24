/*
 * Half-Heard Genius Engine — page behaviour.
 * Speech in (Web Speech API, where supported), speech out (speechSynthesis),
 * saving (localStorage), copying (clipboard), and the provider layer that lets
 * a language model replace the built-in engine later.
 */
(function () {
  'use strict';

  var CONFIG = Object.assign({ llmEndpoint: '' }, window.HALF_HEARD_CONFIG || {});
  var SAVE_KEY = 'halfHeard.saved.v1';
  var BATCH = 5;
  var LISTEN_LIMIT_MS = 10000;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    listen: $('listen'), listenLabel: $('listen-label'), noSpeechNote: $('no-speech-note'),
    form: $('type-form'), phrase: $('phrase'), status: $('status'),
    results: $('results'), heard: $('heard'), list: $('list'), emptyHint: $('empty-hint'),
    more: $('more'), read: $('read'), save: $('save'), copy: $('copy'),
    copyFallback: $('copy-fallback'), copyText: $('copy-text'),
    saved: $('saved'), savedEmpty: $('saved-empty'), copySaved: $('copy-saved'), engineNote: $('engine-note')
  };

  // Everything currently on screen.
  var current = null; // { heard, alternatives, interpretations: [], batches: [[...]], usedTemplates, provider }

  // ---------------------------------------------------------------------------
  // Providers. The built-in engine always works. A remote language-model
  // provider is used only when CONFIG.llmEndpoint is set; if it fails we fall
  // back to the built-in engine and say so.
  // ---------------------------------------------------------------------------
  var builtInProvider = {
    name: 'built-in engine',
    generate: function (phrase, opts) { return Promise.resolve(window.HalfHeard.generate(phrase, opts)); }
  };

  var remoteProvider = {
    name: 'language model',
    generate: function (phrase, opts) {
      var controller = 'AbortController' in window ? new AbortController() : null;
      var timer = controller && setTimeout(function () { controller.abort(); }, 30000);
      return fetch(CONFIG.llmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: phrase, count: opts.count, avoid: opts.avoidTexts || [], alternatives: opts.alternatives || [] }),
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error('Server answered ' + res.status);
        return res.json();
      }).then(function (data) {
        if (!data || !Array.isArray(data.interpretations) || !data.interpretations.length) throw new Error('Empty answer');
        data.interpretations = data.interpretations.slice(0, opts.count).map(function (it, i) {
          return {
            key: 'llm:' + Date.now() + ':' + i,
            text: String(it.text || ''), method: 'llm', methodLabel: String(it.methodLabel || 'Language model'),
            explanation: String(it.explanation || ''), kind: String(it.kind || 'idea'),
            kindLabel: String(it.kindLabel || 'Idea'), idea: String(it.idea || '')
          };
        }).filter(function (it) { return it.text && it.idea; });
        if (!data.interpretations.length) throw new Error('Unusable answer');
        data.heard = data.heard || phrase;
        return data;
      }).finally(function () { if (timer) clearTimeout(timer); });
    }
  };

  function generate(phrase, opts) {
    if (!CONFIG.llmEndpoint) return builtInProvider.generate(phrase, opts);
    return remoteProvider.generate(phrase, opts).catch(function () {
      announce('The language model was not available, so I used the built-in engine.');
      return builtInProvider.generate(phrase, opts);
    });
  }

  el.engineNote.textContent = CONFIG.llmEndpoint
    ? 'Using a language model, with the built-in engine as a backup.'
    : 'Using the built-in engine: no API key, no account, works offline once loaded.';

  // ---------------------------------------------------------------------------
  // Status messages (visible and announced by screen readers)
  // ---------------------------------------------------------------------------
  var announceTimer;
  function announce(msg) {
    clearTimeout(announceTimer);
    // Clearing first makes screen readers repeat an identical message.
    el.status.textContent = '';
    announceTimer = setTimeout(function () { el.status.textContent = msg; }, 60);
  }

  // ---------------------------------------------------------------------------
  // Short beeps so people know when to start and stop talking.
  // ---------------------------------------------------------------------------
  var audioCtx;
  function beep(freq, ms) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + ms / 1000 + 0.05);
    } catch (e) { /* sound is a nicety */ }
  }

  // ---------------------------------------------------------------------------
  // Speech recognition
  // ---------------------------------------------------------------------------
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null, listening = false, listenTimer = null, gotResult = false, finalText = '', altTexts = [];

  function offerTyping(reason) {
    el.noSpeechNote.hidden = false;
    if (reason) el.noSpeechNote.querySelector('strong').textContent = reason;
    el.phrase.focus();
  }

  if (!Recognition) {
    el.noSpeechNote.hidden = false;
    el.listen.setAttribute('aria-describedby', 'no-speech-note');
  }

  function setListening(on) {
    listening = on;
    el.listen.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.listenLabel.textContent = on ? 'Listening… press to stop' : 'Listen';
    el.listen.querySelector('.btn-icon').textContent = on ? '◉' : '●';
  }

  function startListening() {
    if (!Recognition) {
      announce('Voice input is not available in this browser. Please type your phrase instead.');
      offerTyping();
      return;
    }
    if (!window.isSecureContext) {
      announce('Voice input needs a secure page, starting with https or localhost. Please type your phrase instead.');
      offerTyping('Voice input needs a secure (https) page.');
      return;
    }
    stopReading();
    recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = false;
    gotResult = false; finalText = ''; altTexts = [];

    recognition.onstart = function () {
      setListening(true);
      beep(880, 120);
      announce('Listening. Say a short phrase.');
      listenTimer = setTimeout(stopListening, LISTEN_LIMIT_MS);
    };
    recognition.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
          for (var j = 1; j < res.length; j++) altTexts.push(res[j].transcript);
        } else {
          interim += res[0].transcript;
        }
      }
      // Show partial words visually, but don't announce every flicker.
      el.heard.textContent = (finalText + interim).trim() || 'Listening…';
    };
    recognition.onerror = function (event) {
      var messages = {
        'not-allowed': 'Microphone permission was turned down. You can allow it in your browser settings, or type your phrase.',
        'service-not-allowed': 'Voice input is switched off for this browser. On iPhone, turn on Dictation in Settings, General, Keyboard. Or type your phrase.',
        'no-speech': 'I did not hear anything. Press Listen to try again, or type your phrase.',
        'audio-capture': 'No microphone was found. Please type your phrase instead.',
        'network': 'Voice input in this browser needs an internet connection. Please type your phrase instead.',
        'language-not-supported': 'Voice input does not support your language setting here. Please type your phrase.'
      };
      if (event.error === 'aborted') return;
      gotResult = true; // stop onend from adding a second message
      announce(messages[event.error] || 'Voice input stopped unexpectedly. Please try again or type your phrase.');
      if (event.error !== 'no-speech') offerTyping();
    };
    recognition.onend = function () {
      clearTimeout(listenTimer);
      var wasListening = listening;
      setListening(false);
      if (wasListening) beep(520, 120);
      var text = finalText.trim();
      if (text) { gotResult = true; el.phrase.value = text; runNew(text, altTexts); }
      else if (!gotResult) {
        el.heard.textContent = current ? current.heard : 'Nothing yet.';
        announce('I did not catch that. Press Listen to try again, or type your phrase.');
      }
    };

    try { recognition.start(); }
    catch (e) { announce('Voice input could not start. Please type your phrase instead.'); offerTyping(); }
  }

  function stopListening() {
    clearTimeout(listenTimer);
    if (recognition) { try { recognition.stop(); } catch (e) { /* already stopped */ } }
  }

  el.listen.addEventListener('click', function () { listening ? stopListening() : startListening(); });

  // ---------------------------------------------------------------------------
  // Typed input
  // ---------------------------------------------------------------------------
  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = el.phrase.value.trim();
    if (!text) { announce('Please type a phrase first.'); el.phrase.focus(); return; }
    runNew(text, []);
  });

  // ---------------------------------------------------------------------------
  // Generating and showing results
  // ---------------------------------------------------------------------------
  function randomSeed() { return Math.floor(Math.random() * 4294967295); }

  function runNew(phrase, alternatives) {
    stopReading();
    current = { heard: phrase, alternatives: alternatives || [], interpretations: [], batches: [], usedTemplates: {} };
    el.list.innerHTML = '';
    el.copyFallback.hidden = true;
    return addBatch(true);
  }

  function addBatch(isFirst) {
    var opts = {
      count: BATCH,
      seed: randomSeed(),
      exclude: current.interpretations.map(function (i) { return i.key; }),
      avoidTexts: current.interpretations.map(function (i) { return i.text; }),
      alternatives: isFirst ? current.alternatives : [],
      usedTemplates: current.usedTemplates
    };
    announce(isFirst ? 'Thinking…' : 'Finding more misunderstandings…');
    return generate(current.heard, opts).then(function (result) {
      if (!result.interpretations.length) { announce('I could not find any words to work with. Try another phrase.'); return; }
      if (isFirst) current.heard = result.heard || current.heard;
      var startNumber = current.interpretations.length + 1;
      current.interpretations = current.interpretations.concat(result.interpretations);
      current.batches.push(result.interpretations);
      render(result.interpretations, startNumber, !isFirst);
      var n = result.interpretations.length;
      announce(isFirst
        ? 'I heard: ' + current.heard + '. ' + n + ' misunderstandings are ready below.'
        : n + ' more misunderstandings added, starting at number ' + startNumber + '.');
    });
  }

  function render(items, startNumber, separated) {
    el.heard.textContent = '“' + current.heard + '”';
    el.emptyHint.hidden = true;
    items.forEach(function (it, i) {
      var n = startNumber + i;
      var li = document.createElement('li');
      if (separated && i === 0) li.setAttribute('aria-label', 'More misunderstandings, number ' + n);

      var h = document.createElement('h3');
      h.textContent = n + '. ' + it.text;

      var how = document.createElement('p');
      how.className = 'method';
      how.appendChild(labelSpan('How: '));
      how.appendChild(document.createTextNode(it.methodLabel + '. ' + it.explanation));

      var idea = document.createElement('p');
      idea.className = 'idea';
      idea.appendChild(labelSpan(it.kindLabel + ': '));
      idea.appendChild(document.createTextNode(it.idea));

      li.appendChild(h); li.appendChild(how); li.appendChild(idea);
      el.list.appendChild(li);
    });
  }

  function labelSpan(text) {
    var s = document.createElement('span');
    s.className = 'label';
    s.textContent = text;
    return s;
  }

  function needResults(action) {
    if (current && current.interpretations.length) return false;
    var typed = el.phrase.value.trim();
    if (action === 'more' && typed) { runNew(typed, []); return true; }
    announce('Nothing to ' + action + ' yet. Press Listen or type a phrase first.');
    return true;
  }

  el.more.addEventListener('click', function () {
    if (needResults('more')) return;
    stopReading();
    addBatch(false);
  });

  // ---------------------------------------------------------------------------
  // Plain text (for copying, saving and reading aloud)
  // ---------------------------------------------------------------------------
  function asPlainText(record) {
    var lines = ['Half-Heard Genius Engine', 'Heard: ' + record.heard, ''];
    record.interpretations.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.text);
      lines.push('   How: ' + it.methodLabel + '. ' + it.explanation);
      lines.push('   ' + it.kindLabel + ': ' + it.idea.replace(/\n\s*/g, ' / '));
      lines.push('');
    });
    if (record.savedAt) lines.push('Saved ' + new Date(record.savedAt).toLocaleString());
    return lines.join('\n').trim();
  }

  function copyText(text, label) {
    function fallback() {
      el.copyFallback.hidden = false;
      el.copyText.value = text;
      el.copyText.focus();
      el.copyText.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      announce(ok ? label + ' copied as plain text.' : 'Copying is blocked here. The plain text is in the box, selected, ready to copy.');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { announce(label + ' copied as plain text.'); }, fallback);
    } else fallback();
  }

  el.copy.addEventListener('click', function () {
    if (needResults('copy')) return;
    copyText(asPlainText(current), 'Results');
  });

  // ---------------------------------------------------------------------------
  // Read aloud
  // ---------------------------------------------------------------------------
  var synth = window.speechSynthesis;
  var reading = false;

  function stopReading() {
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
    setReading(false);
  }
  function setReading(on) {
    reading = on;
    el.read.textContent = on ? 'Stop Reading' : 'Read Aloud';
  }

  function speakChunks(chunks) {
    synth.cancel();
    setReading(true);
    var lang = navigator.language || 'en-US';
    chunks.forEach(function (text, i) {
      // Short utterances avoid browsers that cut off long speech.
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.95;
      if (i === chunks.length - 1) { u.onend = function () { setReading(false); }; }
      u.onerror = function () { setReading(false); };
      synth.speak(u);
    });
  }

  el.read.addEventListener('click', function () {
    if (!synth || !('SpeechSynthesisUtterance' in window)) {
      announce('Reading aloud is not available in this browser. Your screen reader can read the results instead.');
      return;
    }
    if (reading) { stopReading(); announce('Stopped reading.'); return; }
    if (needResults('read')) return;
    var latest = current.batches[current.batches.length - 1];
    var first = current.interpretations.indexOf(latest[0]) + 1;
    var chunks = ['I heard: ' + current.heard + '.'];
    latest.forEach(function (it, i) {
      chunks.push('Number ' + (first + i) + '. ' + it.text + '.');
      chunks.push(it.methodLabel + '. ' + it.explanation);
      chunks.push(it.kindLabel + '. ' + it.idea.replace(/\n\s*/g, ' '));
    });
    speakChunks(chunks);
  });

  // ---------------------------------------------------------------------------
  // Saving (this device only)
  // ---------------------------------------------------------------------------
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch (e) { return []; }
  }
  function storeSaved(list) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  el.save.addEventListener('click', function () {
    if (needResults('save')) return;
    var list = loadSaved();
    var record = {
      id: String(Date.now()),
      heard: current.heard,
      savedAt: Date.now(),
      interpretations: current.interpretations.map(function (it) {
        return { text: it.text, methodLabel: it.methodLabel, explanation: it.explanation, kindLabel: it.kindLabel, idea: it.idea };
      })
    };
    // Saving the same phrase again replaces the older copy with the fuller one.
    if (current.saveId) list = list.filter(function (r) { return r.id !== current.saveId; });
    current.saveId = record.id;
    list.unshift(record);
    if (!storeSaved(list)) { announce('Sorry, this browser would not let me save. Private browsing can block saving.'); return; }
    renderSaved();
    announce('Saved “' + current.heard + '” with ' + record.interpretations.length + ' misunderstandings. It is in the Saved list.');
  });

  function renderSaved() {
    var list = loadSaved();
    el.saved.innerHTML = '';
    el.savedEmpty.hidden = list.length > 0;
    el.copySaved.hidden = list.length === 0;
    list.forEach(function (rec) {
      var li = document.createElement('li');
      var details = document.createElement('details');
      var summary = document.createElement('summary');
      summary.textContent = '“' + rec.heard + '” — ' + rec.interpretations.length + ' ideas, saved ' + new Date(rec.savedAt).toLocaleDateString();
      var body = document.createElement('p');
      body.className = 'saved-body';
      body.textContent = asPlainText(rec).split('\n').slice(3).join('\n');
      details.appendChild(summary); details.appendChild(body);

      var row = document.createElement('div');
      row.className = 'row';
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button'; copyBtn.className = 'btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy saved “' + rec.heard + '”');
      copyBtn.addEventListener('click', function () { copyText(asPlainText(rec), 'Saved result'); });
      var delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'btn';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('aria-label', 'Delete saved “' + rec.heard + '”');
      delBtn.addEventListener('click', function () {
        storeSaved(loadSaved().filter(function (r) { return r.id !== rec.id; }));
        if (current && current.saveId === rec.id) current.saveId = null;
        renderSaved();
        announce('Deleted “' + rec.heard + '”.');
        // Keep keyboard focus somewhere sensible after the item disappears.
        (el.saved.querySelector('summary') || $('saved-heading')).focus();
      });
      row.appendChild(copyBtn); row.appendChild(delBtn);

      li.appendChild(details); li.appendChild(row);
      el.saved.appendChild(li);
    });
  }

  el.copySaved.addEventListener('click', function () {
    var all = loadSaved().map(asPlainText).join('\n\n----------\n\n');
    copyText(all, 'All saved results');
  });

  renderSaved();

  // Stop talking if the page is hidden (for example, switching apps on iPhone).
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopReading(); if (listening) stopListening(); }
  });

  // Small hook for automated tests.
  window.__halfHeard = { runNew: runNew, current: function () { return current; } };
})();
