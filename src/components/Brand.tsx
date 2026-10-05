import { Activity } from 'lucide-react';

export default function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><span className="brand-symbol"><Activity size={small ? 16 : 24} strokeWidth={2.4} /></span><span className="brand-name">Train with me</span></div>;
}
