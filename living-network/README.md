# Living Network

A one-page, phone-first app that shows AI amplifying a group's thinking instead of replacing it.

1. Press **RECORD CONVERSATION** and talk.
2. Your speech is transcribed live. Pick who is speaking with a name button (or keys `1`–`9`, or say *"my name is Sam"* / *"switch to Sam"*).
3. Claude pulls short ideas out of each person's words and links an idea to another person's earlier idea when it builds on it.
4. The network draws people as large circles, their ideas as small ones, and connections as dashed arrows.
5. Press **SHOW US WHAT WE CREATED** (or say it) to see what each person brought, the connections, and the emergent ideas, each with the exact statements that produced it.

## How "AI-originated ideas: 0" is kept true

- Every extracted idea must carry a quote that really appears in what the person said. Ideas whose quote can't be found are thrown away.
- A connection only counts between ideas from two **different** people.
- An emergent idea only counts if it cites real lines from **at least two** people. Those lines are shown word for word.

## Run it

Browsers only allow the microphone on `https://` or `localhost`:

```bash
cd living-network
python3 -m http.server 8000
```

Open <http://localhost:8000> in Chrome, Edge or Safari. Open **Settings and session**, paste an Anthropic API key, and press Record.

Without a key, it still works in a basic way: each sentence becomes its own idea, and no connections or emergent ideas are found.

## Accessibility

- Works fully from the keyboard: `R` record or stop, `1`–`9` speaker, `S` show what we created, `Esc` stop reading aloud.
- Screen readers hear new ideas and connections as they appear. The network also has a text version under "The network as a list".
- High contrast in both dark and light modes, large touch targets, results can be read aloud.

## Privacy

- Speech becomes text in the browser (Chrome uses Google's speech service). The text goes to Anthropic's API with your key.
- The session is saved only in this browser's local storage. **Start a new session** clears it.
- Tell everyone they are being recorded.
