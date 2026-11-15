import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Undertone · Context before conclusions',description:'Your evidence-grounded relationship workspace.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
