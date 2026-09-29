# Schwab CSV import

## First implementation

Parse the sectioned Schwab tax CSV locally, separately from the calculation
engine. The source layout was inspected locally; customer data is not a test
fixture and must not enter version control. Tests use invented records.

The review displays every summary box and every 1099-B column with CSV record
numbers. Quoted multiline fields count as one CSV record. It retains the file in
memory until dismissed; merely opening a file never changes the return.

Apply is atomic and initially limited to plain 1099-INT boxes 1, 3 and 8 and
1099-DIV boxes 1a, 1b and 2a. INT 1 + 3 become taxable interest; INT 8 is exempt;
DIV 1b is already included in 1a. The user must review eligibility, exclusions,
and whether these records were already entered manually. Schedule B Part III
answers remain the user's responsibility.

Any populated unsupported box, OID income, or sale blocks the entire application.
Sales are previewed with coverage, adjustment and zero-basis warnings, but are
not converted into the prototype's covered-stock-only model. Adding Form 8949,
bond/OID support or interpreting securities is a separate tax implementation.
Corrected statements require replacement reconciliation and cannot be appended.
2024 files can be reviewed but cannot enter a 2025 return.

Reject ambiguous summary amounts, duplicate boxes/summary forms, malformed CSV,
unknown sections/columns/boxes, excessive input and invalid numbers. Known blank
monetary boxes mean zero within a recognized complete section; missing required
boxes block application. Never infer a tax year or treat unknown data as zero.

Append supported payer records with a receipt in an additive v1 `brokerImports`
extension. Receipts preserve filename, tax year, SHA-256 of canonical CSV records,
and each destination field's original value, source form/box and CSV record
numbers. Hashing happens on the device; account metadata is not saved. The
receipt remains after editing/deleting a payer, permitting duplicate detection
and comparison against the original imported value. Existing drafts migrate to
an empty receipt list. JSON saves remain unencrypted.

No new tax calculation engine or tax rule is introduced. Mapping sources:
- https://www.irs.gov/pub/irs-prior/i1040sb--2025.pdf (Schedule B lines 1 and 5)
- https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf (1040 lines 2a/2b/3a/3b)
- https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf (Schedule D line 13)

Validation covers parsing, supported mapping through the existing calculation,
unsupported and malformed input, wrong years, corrections, duplicate files,
atomic application, provenance persistence and browser DOM interactions.

## Additional form sections and review messages

Every `Form ...` heading now starts a separate section. Unimplemented forms,
including 1099-MISC, receive a section-level blocking notice; their rows are
retained without being mapped to the preceding form's box numbers. Unknown
layouts remain review-only. The royalty fields in a MISC section must never
be interpreted as interest fields.

OID box 7 descriptions and DIV box 8 / INT box 7 country names are metadata
when both their box identifiers and descriptions match the observed layout.
Text in their Details column stays visible without generating an unsupported
amount error. Unexpected Amount/Total values still block, as do foreign tax
paid, OID income, premiums, section 199A dividends, sales and other unsupported
monetary items. No calculation scope has expanded.

Repeated review messages show counts with collapsed record lists. Consecutive
record numbers are displayed as ranges. Synthetic regressions include an
INT → MISC → OID transition and a 492-sale review. The separate local 2025
sample confirms section recognition without including customer data in tests.
