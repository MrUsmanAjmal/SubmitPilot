import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
export const metadata:Metadata={title:{default:'SubmitPilot — Find where your research belongs',template:'%s | SubmitPilot'},description:'Discover research journals through evidence-linked literature matching, screen your manuscript, and prepare your submission — in one thoughtful workspace.',robots:{index:true,follow:true},openGraph:{title:'SubmitPilot',description:'A clearer path from manuscript to journal submission.',type:'website'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Header/><main>{children}</main><Footer/></body></html>;}
