## ADDED Requirements

### Requirement: Calibration runs SHALL execute through a LangGraph state machine
The system SHALL represent calibration execution as a LangGraph workflow with explicit run state and node transitions for translation, deterministic verification, repair, review, and terminal outcomes.

#### Scenario: Executing the standard graph path
- **WHEN** a calibration run starts with valid inputs
- **THEN** the system initializes graph state and executes the run through the configured LangGraph nodes in dependency order

#### Scenario: Inspecting graph-driven run state
- **WHEN** an operator inspects a completed or failed calibration run
- **THEN** the system can identify which workflow node produced the terminal outcome and which transitions occurred before it

### Requirement: LangGraph orchestration SHALL route drafts based on verification outcomes
The system SHALL use deterministic verification results to decide whether a translation draft proceeds directly to review or is sent to repair first.

#### Scenario: Clean draft proceeds to review
- **WHEN** deterministic verification reports no hard defects for a translation draft
- **THEN** the graph routes the run from verification to review without invoking repair

#### Scenario: Defective draft proceeds to repair
- **WHEN** deterministic verification reports one or more hard defects for a translation draft
- **THEN** the graph routes the run to a repair node with the structured defect payload attached to run state

### Requirement: Repair loops SHALL be bounded
The system SHALL limit the number of repair rounds for a calibration run and SHALL produce an explicit terminal outcome when hard defects remain unresolved after the configured limit.

#### Scenario: Repair succeeds within the allowed limit
- **WHEN** a repair round clears all hard defects before the configured limit is reached
- **THEN** the graph routes the run forward to review and records the number of repair rounds used

#### Scenario: Repair limit is exhausted
- **WHEN** hard defects remain after the configured maximum number of repair rounds
- **THEN** the graph terminates the run with an escalated or failed outcome and records the unresolved defects in the run artifacts
