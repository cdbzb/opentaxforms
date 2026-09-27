// Layout and line identities: official 2025 Form 1040, pages 1–2.
// https://www.irs.gov/pub/irs-prior/f1040--2025.pdf
// This registry describes support, not tax calculation rules.
export type Support = 'supported' | 'amount' | 'flag' | 'result' | 'detail';
export interface Form1040Line { line: string; label: string; support: Support; needs: string }
const line = (id: string, label: string, support: Support, needs = ''): Form1040Line => ({line:id,label,support,needs});
export const incomeLines = [
  line('1a','Wages from Form W-2, box 1','supported'),
  line('1b','Household employee wages not on Form W-2','amount','Household wage reporting and employment-tax checks.'),
  line('1c','Tip income not on line 1a','amount','Tip reporting and Form 4137 when required.'),
  line('1d','Medicaid waiver payments not on Form W-2','amount','Medicaid waiver payment treatment and exclusions.'),
  line('1e','Taxable dependent care benefits','amount','Form 2441 and dependent care benefit calculations.'),
  line('1f','Employer-provided adoption benefits','amount','Form 8839 and adoption benefit calculations.'),
  line('1g','Wages from Form 8919','amount','Form 8919 and uncollected payroll-tax calculations.'),
  line('1h','Other earned income','amount','Income-type classification and applicable supporting forms.'),
  line('1i','Nontaxable combat pay election','amount','Combat pay election and credit interactions.'),
  line('1z','Total wages and earned income','supported'),
  line('2a','Tax-exempt interest','amount','Interest reporting and tax-exempt-income interactions.'),
  line('2b','Taxable interest','amount','Form 1099-INT entry and Schedule B when required.'),
  line('3a','Qualified dividends','amount','Form 1099-DIV entry and the qualified-dividends tax worksheet.'),
  line('3b','Ordinary dividends','amount','Form 1099-DIV entry and Schedule B when required.'),
  line('3c','Child’s dividends included in line 3a or 3b','flag','Form 8814 and child-income reporting.'),
  line('4a','IRA distributions','amount','Retirement distribution entry, basis and rollover treatment.'),
  line('4b','Taxable IRA distributions','amount','IRA taxable-amount calculation and Form 8606 when required.'),
  line('4c','IRA distribution checkboxes: rollover, QCD, other','flag','Rollover and qualified charitable distribution reporting.'),
  line('5a','Pensions and annuities','amount','Retirement distribution entry and pension basis rules.'),
  line('5b','Taxable pensions and annuities','amount','Pension and annuity taxable-amount worksheets.'),
  line('5c','Pension checkboxes: rollover, PSO, other','flag','Rollover and public safety officer distribution rules.'),
  line('6a','Social security benefits','amount','Form SSA-1099 entry and the taxable-benefits worksheet.'),
  line('6b','Taxable social security benefits','amount','The social security benefits worksheet and income interactions.'),
  line('6c','Social security lump-sum election','flag','The lump-sum election worksheets.'),
  line('6d','Married filing separately and lived apart all year','flag','Social security filing-status and living-arrangement rules.'),
  line('7a','Capital gain or (loss)','supported'),
  line('7b','Schedule D exception / child’s capital gain or loss','flag','Schedule D exception and child-income reporting.'),
  line('8','Additional income from Schedule 1, line 10','amount','Schedule 1 and its supporting income forms.'),
  line('9','Total income','supported'),
  line('10','Adjustments to income from Schedule 1, line 26','amount','Schedule 1 adjustments and supporting deduction worksheets.'),
  line('11a','Adjusted gross income','supported'),
];
export const taxLines = [
  line('11b','Adjusted gross income from line 11a','supported'),
  line('12a','Someone can claim you or your spouse as a dependent','flag','Dependent standard-deduction limits and eligibility checks.'),
  line('12b','Spouse itemizes on a separate return','flag','Married-filing-separately deduction eligibility.'),
  line('12c','You were a dual-status alien','flag','Dual-status filing and deduction rules.'),
  line('12d','Age or blindness additions for you or your spouse','flag','Age/blindness eligibility and additional standard deductions.'),
  line('12e','Standard deduction or itemized deductions','supported'),
  line('13a','Qualified business income deduction','amount','Forms 8995/8995-A and business-income integration.'),
  line('13b','Additional deductions from Schedule 1-A, line 38','amount','Schedule 1-A eligibility and deduction calculations.'),
  line('14','Total deductions','supported'),
  line('15','Taxable income','supported'),
  line('16','Tax (including applicable Form 8814 / 4972 amounts)','result','Verified tax tables, preferential-rate worksheets and special tax forms.'),
  line('17','Tax from Schedule 2, line 3','amount','Schedule 2 Part I and applicable supporting tax forms.'),
  line('18','Tax before credits','result','Completed lines 16 and 17.'),
  line('19','Child tax credit / credit for other dependents','amount','Schedule 8812 and dependent eligibility.'),
  line('20','Credits from Schedule 3, line 8','amount','Schedule 3 Part I and supporting credit forms.'),
  line('21','Total nonrefundable credits','result','Completed credit calculations for lines 19 and 20.'),
  line('22','Tax after nonrefundable credits','result','Completed tax and credit calculations.'),
  line('23','Other taxes, including self-employment tax','amount','Schedule 2 Part II and applicable supporting forms.'),
  line('24','Total tax','result','Completed tax, credit and other-tax calculations.'),
];
export const paymentLines = [
  line('25a','Federal income tax withheld: Forms W-2','amount','W-2 withholding entry and payment reconciliation.'),
  line('25b','Federal income tax withheld: Forms 1099','amount','Form 1099 withholding entry and reconciliation.'),
  line('25c','Federal income tax withheld: other forms','amount','Other withholding source forms and reconciliation.'),
  line('25d','Total federal income tax withheld','result','Completed withholding entries from lines 25a–25c.'),
  line('26','Estimated payments and amount applied from 2024','amount','Estimated-payment records and prior-year payment reconciliation.'),
  line('27a','Earned income credit','amount','EIC eligibility, earned-income calculations and Schedule EIC.'),
  line('27b','Clergy filing Schedule SE','flag','Clergy income treatment and Schedule SE.'),
  line('27c','Election not to claim the EIC','flag','EIC eligibility and election handling.'),
  line('28','Additional child tax credit / election not to claim it','amount','Schedule 8812 refundable credit and election handling.'),
  line('29','American opportunity credit','amount','Form 8863 and education-credit eligibility.'),
  line('30','Refundable adoption credit','amount','Form 8839 and adoption-credit eligibility.'),
  line('31','Payments and credits from Schedule 3, line 15','amount','Schedule 3 Part II and supporting forms.'),
  line('32','Total other payments and refundable credits','result','Completed lines 27a through 31.'),
  line('33','Total payments','result','Completed withholding, estimated payments and refundable credits.'),
];
export const refundLines = [
  line('34','Overpayment','result','Verified total tax and total payments.'),
  line('35a','Amount to refund / Form 8888 allocation','result','Verified overpayment and refund allocation.'),
  line('35b','Direct deposit routing number','detail','Refund and direct-deposit support. Banking details are not collected.'),
  line('35c','Account type: checking or savings','detail','Refund and direct-deposit support.'),
  line('35d','Direct deposit account number','detail','Refund and direct-deposit support. Banking details are not collected.'),
  line('36','Overpayment applied to 2026 estimated tax','result','Verified overpayment and next-year payment election.'),
];
export const owedLines = [
  line('37','Amount you owe','result','Verified total tax and total payments.'),
  line('38','Estimated tax penalty','result','Payment timing and Form 2210 when required.'),
];
export const contextItems = [
  line('digital-assets','Digital assets','flag','Digital-asset reporting and transaction classification.'),
  line('dependents','Dependents','flag','Dependent information, eligibility and related credits.'),
  line('filing-special','Special filing circumstances','flag','Nonresident-spouse elections, special filing periods and other filing-status details.'),
];
export const itemized = line('itemized','Itemized deductions (Schedule A)','amount','Schedule A deductions and comparison with the standard deduction.');
export const form1040Lines = [...incomeLines,...taxLines,...paymentLines,...refundLines,...owedLines];
export const recordable1040 = [...form1040Lines,...contextItems,itemized].filter(f=>f.support==='amount'||f.support==='flag');
export const unsupportedField = (id: string) => recordable1040.find(f=>f.line===id);
