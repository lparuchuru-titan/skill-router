---
name: write-unit-tests
description: Write or fix unit tests. Use for Jest, pytest, a failing assertion, or a test-data factory.
keywords: jest, pytest, unit test, failing assertion, test-data factory
---

# Write unit tests

Load this skill when the task is a test, not a product change.

1. Read the unit under test and name the behavior you are proving.
2. Prefer one assertion per behavior. Include a failure case, not only the happy path.
3. Keep fixtures next to the test. Do not invent production code to make a test pass.
