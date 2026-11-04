# Authoring and publishing mock tests

## Admin workflow

1. Open **Admin → Mock tests** and create a test with a title and duration. The
   URL slug is generated from the title; new tests are saved as drafts.
2. Open **Admin → Questions**. Create questions and publish them from the review
   workflow. The mock-test picker only accepts active, published
   `single_correct` or `multiple_correct` questions with at least two options
   and a valid correct answer.
3. Return to **Admin → Mock tests → Questions** for the test and add the
   published questions. The question and marks totals refresh from the linked
   questions.
4. Preview the test, then click **Publish**. Publishing is blocked if the test
   has no questions or any attached question is inactive or unpublished.

Changing the question set of a published test automatically returns it to draft.
Publish it again after reviewing the updated test. The question set cannot be
changed while a student has an in-progress attempt.

## Student workflow

Published tests with questions appear in the student mock-test catalogue. A
student opens a test, reviews its duration and question count, and selects
**Start test**. Starting requires a signed-in account; premium tests additionally
require an active premium entitlement or a test access grant.

The attempt API freezes the question paper, starts the server-side timer, hides
correct answers while the test is in progress, and saves responses. Students
submit the attempt to receive their result.
