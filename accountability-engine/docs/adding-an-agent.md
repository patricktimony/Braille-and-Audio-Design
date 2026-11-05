# Adding an investigation agent

Agents live in `accountability_engine/agents/`. Each agent handles one kind of
*subject*. The built-in `TransactionAgent` handles
`{"type": "transaction", "transaction_id": n}`. Future agents could take on
subjects like these:

- `{"type": "contract", "document_id": n}`, to compare billed amounts with the
  terms a contract states
- `{"type": "insurance_claim", ...}`, to compare explanation-of-benefits
  documents with provider bills
- `{"type": "subscription", "merchant_key": "..."}`, to build the full life
  history of a subscription
- `{"type": "government_fee", ...}`, to check a fee against a published
  schedule the user imports

## Rules every agent must follow

1. **Use only the Toolbox.** Every call to a tool is logged and shown to the
   user. Add new tools to `agents/tools.py` with the `@logged` decorator.
2. **Facts need evidence.** A `Fact` must cite at least one evidence item:
   `transaction`, `receipt`, `calculation` or `absence`. All of these are built
   from stored records by the helpers in `analysis/evidence.py`.
3. **Readings are not facts.** If you interpret text (a code, a prefix, a
   clause), record it as an `Interpretation` and explain its basis.
4. **Hypotheses are labelled.** Give each one a confidence level ("low",
   "moderate" or "not assessable") and say how to check it.
5. **Name the unknowns.** Say what the evidence cannot answer, and how the
   user could find out.
6. **No outreach.** If a `NextAction` would reach outside the app, it must set
   `requires_approval=True`. The app only ever produces a draft.
7. **Neutral language.** Run your text through `agents/language.py`. The test
   suite does this for the built-in agents.

## Skeleton

```python
from accountability_engine.agents.base import BaseAgent, Fact, Investigation, PlanStep, register
from accountability_engine.analysis.evidence import tx_evidence


@register
class SubscriptionAgent(BaseAgent):
    name = "subscription-investigator"
    description = "Builds the history of one subscription."

    def can_investigate(self, subject):
        return subject.get("type") == "subscription"

    def investigate(self, subject, tools):
        inv = Investigation(agent=self.name, subject=subject,
                            plan=[PlanStep("Collect charges", "Build the timeline")])
        charges = tools.search_transactions(merchant=subject["merchant_key"])
        inv.plan[0].status = "done"
        if charges:
            inv.verified_facts.append(Fact(
                f"{len(charges)} charges found.", [tx_evidence(t) for t in charges]))
        inv.tool_calls = tools.calls
        return inv
```

Then import the module in `agents/__init__.py`, so that registration runs.
`agent_for(subject)` returns the first registered agent that can handle the
subject.
