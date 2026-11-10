# Publishing intake SOP

PLAIGROUND files compositions for the artist. The artist does not get sent away to register the work. Distribution through PLAIGROUND is not required. A composition, a recording, a writer share, a publisher share, and an album group are different things.

This product does not call BMI, ASCAP, SESAC, GMR, The MLC, or a CWR/bulk feed. Do not assume the writer and PLAIGROUND belong to the same PRO. SignWell is only the multi-writer split sheet. It is not a publishing contract. No publishing contract lives in this repo. Do not treat an unsigned draft, a checkbox, or the rights attestation as the publishing agreement.

## Statuses

The artist-facing status is one of six words. Submitted, Registered, Matched, and Paid are shown only when the matching receipt is stored on the row. A browser save cannot invent them.

| Status | Plain language |
| --- | --- |
| Draft | Saved with PLAIGROUND. Nothing has been sent to a society, The MLC, SoundExchange, or YouTube. |
| Not covered | PLAIGROUND is not filing this work. No society status is on file. |
| Submitted | A receipt is on file that this work was sent. That is not acceptance, a match, or a payment. |
| Registered | A receipt is on file that a registry accepted this work. |
| Matched | A receipt is on file that a recording was matched to this work. |
| Paid | A receipt is on file that money was paid for this work. |

Staff still move an internal record through needs information, needs agreement, under review, submitted, accepted, matched, paid, or rejected. The screen maps those to the six words above. Needs agreement and rejected show as Not covered. Under review shows as Draft until a submission receipt exists. Accepted shows as Registered only with the registration receipt.

"Pending at BMI" is not a status. A local save is not a filing.

## 1. Intake

The artist uses Publishing while signed in. The request is stored on that account through `POST /api/me/publishing`.

Collect:

- PRO and IPI for the authorizing writer. Co-writers may use another PRO, or none yet.
- Catalog release id when the recording is already here. Leave it blank when it is not.
- Writer legal names and their shares of the writer half. Those shares must total 100.
- The publisher share PLAIGROUND is asked to represent. The field starts empty. Do not type 100 unless the artist said 100. Other publishers are listed with their own shares. Represented plus other publisher shares cannot pass 100 of the publisher half.
- How the composition was made, and the exact human contribution.
- Optional alternate title, duration, language, ISRC, performers, producers, and featured credits.

An album is an album title plus at least two compositions. Each composition is its own row, with its own writers, share, contribution, and credits. The album title is only the group.

The authorization checkbox lets PLAIGROUND prepare the file. It is not a contract. The same idempotency key returns the saved rows instead of creating a second set. A different key for the same open title is refused.

Creator accounts can save 8 compositions in a UTC month, counted apart from distribution uploads. Pro is not capped. Basic can save a request. No email is sent and no payment is taken.

## 2. Identity, PRO, and IPI

Confirm the IPI is the number from the writer's PRO, 6 to 15 digits. Refuse anything shaped like an SSN, a bank account, or a PRO password. The account IPI can be the one already saved in Settings. Do not assume every co-writer is a BMI member, and do not require a co-writer IPI when they do not have one.

## 3. Mandate and catalog scope

The artist authorizes PLAIGROUND to prepare registration for the named compositions. Scope is one work, an album group, or a later staff record of account, titles, or registration ids. A work that was never distributed here is still in scope when the artist names it.

## 4. Contributors and splits

Writer shares are the writer half only. The represented publisher share is whatever the artist entered. A split sheet can supply writer names. It does not set the publisher share. The historical 50/50 line on the split-sheet page is not an approved publishing agreement.

## 5. Eligibility

Use the current BMI pages, not the distribution sentence.

- Human works with a real contribution can move on once an agreement covers them. Staff still review before filing.
- AI-assisted and "not sure" stay in review. BMI accepts partial AI only when the human part meets the U.S. Copyright Office threshold. [BMI and AI](https://www.bmi.com/special/bmi-and-ai) and the [BMI work registration terms](https://www.bmi.com/legal/work-registration-terms-and-conditions) say a prompt-only work is not eligible. [ASCAP, BMI, and SOCAN](https://www.ascap.com/press/2025/10/10-28-ai-registration-policies) said the same on 28 Oct 2025: entirely AI-generated works are not registered.
- Fully AI or prompt-only stays Needs information. Do not file it. Distribution may still accept the recording. That is a different decision.
- If the contribution is ambiguous, leave it in review. Do not guess it into a filing.

Only humans are writers. An AI tool is not a writer or a publisher.

## 6. Agreement hold

Until a lawyer-reviewed publishing agreement exists outside this product, the public status stays Not covered. The internal record stays at needs agreement.

When that agreement has actually been reviewed and signed, staff record only:

- artist account id
- external reference
- reviewed version (not the word draft)
- signed date
- catalog scope: the whole account, titles, or registration ids

Use the Publishing section on the owner desk, or `POST /api/admin/publishing` with `action: "agreement"` and `reviewed: true`. The read-only admin token cannot write. Do not paste the contract. Recording the reference does not create or approve one.

Covered requests move to under review. The artist still sees Draft until a submission receipt is stored. Prompt-only works stay needs information, which shows as Not covered.

## 7. Staff review, export, and filing

Open the owner desk Publishing section or `GET /api/admin/publishing`. Export `/api/admin/publishing.csv`. The checklist has the writers, PRO, IPI, shares, credits, eligibility, agreement reference, and this note: file it manually. No society API is called.

Before changing the internal record:

- Under review requires the agreement reference and an eligible or reviewed work. The artist still sees Draft.
- Submitted requires Under review plus the outside submission receipt. Partial-AI works also need a staff note that the human contribution was reviewed. The artist sees Submitted.
- Accepted requires Submitted plus a registration receipt. The artist sees Registered.
- Matched requires Accepted plus a match receipt from The MLC, SoundExchange, or YouTube. The artist sees Matched.
- Paid requires Matched plus a payment receipt. The artist sees Paid.
- Rejected requires rejection evidence. The artist sees Not covered.
- Needs information requires a note about what is missing. A prompt-only work stays Not covered.

Put the reference or evidence in the event. That is the audit trail.

## 8. Reconciliation and rejections

Match the outside reference to the composition, not to the album title. An album can have one track accepted and another rejected. Record each result on its own row.

A rejected work can be sent again as a new request. An accepted work is not reopened from the desk. If a society later says a registered work was prompt-only, follow that society's correction path and record the rejection evidence here. BMI's current correction contact for a prompt-only work already in their repertory is reviseworks@bmi.com. Do not invent a bulk correction feed.

## 9. Evidence

Keep the event list on the registration: who acted, the previous status, the next status, the note, and any reference. Artists can read their own rows. They cannot read another account. Staff can read the queue. Nobody sees Submitted, Registered, Matched, or Paid unless that receipt is stored on the row.
