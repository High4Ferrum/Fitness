import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
let nextId = 0;
export default function Modal({title,children,onClose,className=''}:{title:string;children:ReactNode;onClose:()=>void;className?:string}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useRef(`dialog-${++nextId}`);
  const close = useRef(onClose); close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusable = ()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]);
    const input = ref.current?.querySelector<HTMLElement>('input,select,textarea'); (input || focusable()[0])?.focus();
    const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')close.current();if(e.key==='Tab'){const all=focusable(); const first=all[0];const last=all[all.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',handler);
    return ()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',handler);previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId.current} ref={ref}><div className="modal-header"><h2 id={titleId.current}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>;
}
