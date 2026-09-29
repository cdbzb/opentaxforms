// Invented data only. This fixture was not produced by redacting a customer file.
export const csv=(rows:string[][])=>rows.map(r=>r.map(v=>`"${v.replaceAll('"','""')}"`).join(',')).join('\r\n');
export const summaryHeader=['Box','Description','Amount','Total','Details',''];
export const box=(id:string,description:string,value='',details='')=>[id,description,'',value,details,''];
export const footer=()=>box('','FATCA filing requirement');
export const saleHeaders=['Description of property (Example 100 sh. XYZ Co.)','Date acquired','Date sold or disposed','Proceeds','Cost or other basis','Accrued market discount','Wash sale loss disallowed','Short-Term gain loss Long-term gain or loss Ordinary','Form 8949 Code','Check if proceeds from collectibles QOF','Federal income tax withheld','Check if noncovered security','Reported to IRS: Gross proceeds Net proceeds','Check if loss is not allowed based on amount in 1d','Profit or (loss) realized in 2025 on closed contracts','Unrealized profit or (loss) on open contracts-12/31/2024','Unrealized profit or (loss) on open contracts-12/31/2025','Aggregate profit or (loss) on contracts','Check if basis reported to IRS','Bartering','State name','State identification no','State Tax Withheld',''];
export const sale=()=>['10 shares Fictional Company','01/02/2025','06/03/2025','1200.00','1000.00','$0.00','$0.00','Short term','A','','0.00','Covered','Gross proceeds','','','','','','Yes','','','','',''];
export const salesSection=(records:string[][]=[sale()])=>[['Form 1099 B',''],['1a','1b','1c',...Array(21).fill('')],saleHeaders,...records];
export function schwabRows(year='2025'):string[][] {
  return [['Account','SYNTHETIC-ACCOUNT'],['Tax Year',year],[],['Form 1099DIV',''],['Corrected','No',''],summaryHeader,
    box('1a','Total Ordinary Dividends','1,200.50'),['1b','Qualified Dividends','800.25','','',''],box('2a','Total Capital Gain Distributions','200.00'),
    ...['2b','2c','2d','2e','2f'].map(id=>box(id,'Special dividend box')),
    ...Array.from({length:14},(_,i)=>box(String(i+3),'Other dividend box')),footer(),[],['Form 1099INT',''],summaryHeader,
    ...Array.from({length:17},(_,i)=>box(String(i+1),'Interest box '+(i+1),({'1':'12.34','3':'45.67','8':'8.90'} as Record<string,string>)[String(i+1)]||'')),footer()];
}
