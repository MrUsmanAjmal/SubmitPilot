import type { Metadata } from 'next';
import Workspace from '@/components/Workspace';
export const metadata:Metadata={title:'Research workspace',description:'Upload a manuscript, evaluate reporting signals, discover related journals and draft grounded submission answers.'};
export default function WorkspacePage(){return <Workspace/>}
