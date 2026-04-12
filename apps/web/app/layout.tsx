import './globals.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'Sentinel Observability',description:'AI observability and incident intelligence'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
