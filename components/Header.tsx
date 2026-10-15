'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu,ArrowUpRight,X } from 'lucide-react';
import { useState } from 'react';
import Brand from './Brand';
const links=[['/how-it-works','How it works'],['/journals','Find venues'],['/about','About']];
export default function Header(){const path=usePathname();const [open,setOpen]=useState(false);return <header className="site-header"><div className="nav-wrap container"><Link href="/" aria-label="SubmitPilot home" onClick={()=>setOpen(false)}><Brand/></Link><nav aria-label="Main navigation" className={`nav-links ${open?'nav-open':''}`}>{links.map(([href,label])=><Link className={path===href?'nav-active':''} key={href} href={href} onClick={()=>setOpen(false)}>{label}</Link>)}<Link className="mobile-cta" href="/workspace" onClick={()=>setOpen(false)}>Open workspace <ArrowUpRight size={15}/></Link></nav><Link className="nav-cta" href="/workspace">Launch workspace <ArrowUpRight size={15}/></Link><button className="menu-toggle" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} onClick={()=>setOpen(x=>!x)}>{open?<X size={22}/>:<Menu size={22}/>}</button></div></header>}
