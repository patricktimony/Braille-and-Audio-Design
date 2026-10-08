# Spoken Memory

Save facts and ask about them with Siri. Everything is done by voice.

How it sounds:

1. You say "Hey Siri, Remember". Siri asks you to speak. You say the fact, for example "My spare key is with Sam". Siri says "Saved."
2. You say "Hey Siri, Ask my memory". Siri asks you to speak. You say the question, for example "Where is my spare key?". Siri speaks the answer.

Siri cannot take the fact in the same breath as the shortcut name. You say the name, wait for the listening sound, then speak.

The backend is one file, worker.js. It runs free on Cloudflare Workers. Answers come from the Claude API, which you pay for per use. Each question costs a fraction of a cent.

## Part 1. Get a Claude API key

1. In Safari, go to platform.claude.com and sign up or log in.
2. Open Billing and add a small amount of credit, for example 5 dollars.
3. Open API Keys. Tap Create Key. Name it spoken memory.
4. Copy the key. It starts with sk-ant. Paste it into a note for now. You will only see it once.

## Part 2. Make up your secret token

Make up a long password with only letters and numbers, at least 20 characters. Example: blueHorse48pianoLamp93river. Save it in the same note. This keeps strangers out of your memory.

## Part 3. Copy the code

1. In Safari, open this address:
   https://raw.githubusercontent.com/patricktimony/braille-and-audio-design/main/spoken-memory/worker.js
2. The page is only the code. Tap and hold on the text, choose Select All, then Copy.

## Part 4. Deploy on Cloudflare (Safari on iPhone)

Cloudflare's dashboard works on a phone but is crowded. With VoiceOver, use the rotor set to Headings or Buttons to move faster. Menu names may change slightly over time.

1. Go to dash.cloudflare.com and sign up for a free account. Confirm your email.
2. Make the storage:
   1. Open the menu. Choose Storage and Databases, then Workers KV.
   2. Tap Create instance. Name it memory. Tap Create.
3. Make the Worker:
   1. Open the menu. Choose Workers and Pages, or Compute, then Workers.
   2. Tap Create, then Start with Hello World. If asked to choose, pick Worker.
   3. Name it spoken-memory. Tap Deploy.
   4. Tap Edit code. Select all the sample code in the editor and delete it. Paste the code you copied in Part 3.
   5. Tap Deploy. Then go back to the Worker's page.
4. Connect the storage:
   1. On the Worker's page, open Settings, then Bindings.
   2. Tap Add binding. Choose KV namespace.
   3. Variable name: MEMORY, in capitals. KV namespace: memory. Tap Add binding or Save.
5. Add the two secrets:
   1. In Settings, find Variables and Secrets. Tap Add.
   2. Type: Secret. Name: TOKEN. Value: your secret token from Part 2. Save.
   3. Tap Add again. Type: Secret. Name: ANTHROPIC_API_KEY. Value: your Claude key from Part 1. Save, and Deploy if asked.
6. Find your Worker address. It is on the Worker's page and looks like
   https://spoken-memory.yourname.workers.dev
   Copy it into your note.

## Part 5. Build the Remember shortcut

In each step, the action names are exactly as they appear in the Shortcuts app. To add an action, use the search field at the bottom of the shortcut editor, labelled Search for apps and actions, type the action name, then double tap the result.

1. Open the Shortcuts app. Go to the Shortcuts tab.
2. Double tap the Add button, labelled with a plus, at the top right. A new empty shortcut opens.
3. Rename it: double tap the name at the top, choose Rename, type Remember, then double tap Done.
4. Add the action Dictate Text. Leave its settings as they are.
5. Add the action Get Contents of URL. It appears below Dictate Text.
6. In Get Contents of URL, double tap the URL field. Delete what is there and type your Worker address followed by /remember. Example: https://spoken-memory.yourname.workers.dev/remember
7. Still in Get Contents of URL, double tap the button labelled Show More, or the expand arrow next to the action.
8. Double tap Method and choose POST.
9. Under Headers, double tap Add new header. In Key, type x-token. In Text, type your secret token.
10. Under Request Body, make sure JSON is chosen. Double tap Add new field and choose Text.
11. In the new field's Key, type text in lower case.
12. Double tap the field's Text value. Above the keyboard is a row of variables. Choose Dictated Text. If you do not find it, double tap Select Variable and choose Dictated Text from the Dictate Text action.
13. Add the action Speak Text. It should already say Speak Contents of URL. If it does not, set its input to the variable Contents of URL.
14. Double tap Done at the top right.

## Part 6. Build the Ask my memory shortcut

1. In the Shortcuts tab, double tap the Add button.
2. Rename the shortcut to Ask my memory.
3. Add the action Dictate Text.
4. Add the action Get Contents of URL.
5. Set its URL to your Worker address followed by /ask. Example: https://spoken-memory.yourname.workers.dev/ask
6. Double tap Show More.
7. Set Method to POST.
8. Under Headers, Add new header. Key: x-token. Text: your secret token.
9. Under Request Body, choose JSON. Add new field, choose Text.
10. Key: question, in lower case. Text value: the variable Dictated Text.
11. Add the action Speak Text, with input Contents of URL.
12. Double tap Done.

## Part 7. Try it

1. Say "Hey Siri, Remember". After the sound, say "The wifi password is on the fridge". Siri should say "Saved."
2. Say "Hey Siri, Ask my memory". After the sound, say "Where is the wifi password?". Siri should answer.
3. Ask something you never saved. Siri should say "I don't have that saved."

The first time each shortcut runs, iPhone may ask for permission to connect to your Worker address. Choose Always Allow.

## What Siri says when something is wrong

- "Wrong token." The x-token header does not match the TOKEN secret exactly. Check both for extra spaces.
- "Sorry, my memory isn't working right now." The Claude key is wrong, missing, or out of credit. Check Billing at platform.claude.com.
- "I didn't hear anything to remember." or "I didn't hear a question." Dictation caught nothing, or the field key is not text or question in lower case.
- "Not found." The URL does not end in /remember or /ask.
- If Siri reads out a long error page mentioning an exception, the storage binding in Part 4, step 4, is missing or not named MEMORY.
