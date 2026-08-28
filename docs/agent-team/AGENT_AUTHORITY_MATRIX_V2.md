# Tutoria Agent Authority Matrix V2

`PROPOSE` = may recommend a decision; `OWN` = primary implementation authority after accepted requirements; `REVIEW` = adversarial/independent review; `OBSERVE` = read-only evidence; `NO` = must escalate.

| Agent | Product policy | Domain semantics | DB strategy | API/orchestration | Payment provider | Frontend | Security acceptance | Final acceptance |
|---|---|---|---|---|---|---|---|---|
| product_planner | PROPOSE | consult | NO | NO | NO | consult | NO | NO |
| backend_engineer | flag/propose | OWN | consult | consult | NO | NO | NO | NO |
| database_engineer | NO | preserve | OWN | consult | NO | NO | NO | NO |
| integration_engineer | NO | preserve | consult | OWN | consult | consult | NO | NO |
| payments_engineer | NO | preserve | consult | consult | OWN | NO | NO | NO |
| frontend_engineer | NO | preserve | NO | consume | NO | OWN | NO | NO |
| security_reviewer | NO | review | REVIEW | REVIEW | REVIEW | REVIEW | REVIEW | NO |
| qa_engineer | NO | test | test | test | test | NO | test | NO |
| qa_browser | NO | NO | NO | black-box test | black-box | test | black-box | NO |
| independent_verifier | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | REVIEW |
| context_scout | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | OBSERVE | NO |
| orchestrator | route/escalate | route | route | route | route | route | route | synthesize evidence |

No agent may silently settle a `PRODUCT_DECISION_REQUIRED` item outside its authority.
