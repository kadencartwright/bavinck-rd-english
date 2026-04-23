## ADDED Requirements

### Requirement: Judge review findings SHALL carry explicit routing dispositions
The system SHALL normalize judge review output into structured findings that include a machine-readable disposition indicating whether the draft should be accepted, repaired, re-reviewed, or escalated.

#### Scenario: Review identifies an auto-repairable issue
- **WHEN** judge review finds a bounded issue that is marked repairable with sufficient confidence
- **THEN** the normalized review finding records a disposition of `repair` and includes metadata needed for downstream routing

#### Scenario: Review identifies an unresolved high-risk issue
- **WHEN** judge review finds a high-risk semantic or doctrinal concern that is not safe for automated remediation
- **THEN** the normalized review finding records a disposition of `escalate`

### Requirement: Calibration workflows SHALL route post-review outcomes explicitly
The system SHALL evaluate structured review findings after judge review and produce an explicit routing decision rather than terminating immediately after review.

#### Scenario: Review passes without actionable findings
- **WHEN** judge review returns no findings that require repair, re-review, or escalation
- **THEN** the routing stage marks the draft accepted and sends the run to a reviewed terminal outcome

#### Scenario: Review produces actionable repair findings
- **WHEN** judge review returns one or more findings with a `repair` disposition
- **THEN** the routing stage creates repair work and routes the run through repair before any final terminal outcome is recorded

#### Scenario: Review requires escalation
- **WHEN** judge review returns one or more findings with an `escalate` disposition
- **THEN** the routing stage terminates the run with an escalated outcome and records the reason in run artifacts

### Requirement: Review routing decisions SHALL remain inspectable
The system SHALL persist a routing summary artifact that shows the findings considered, the decision taken, and the next action selected by the graph.

#### Scenario: Inspecting a routed review outcome
- **WHEN** an operator inspects a run after judge review
- **THEN** the run artifacts identify whether the router accepted, repaired, re-reviewed, or escalated the draft and which findings drove that decision
