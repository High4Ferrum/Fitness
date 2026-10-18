const logoUrl = new URL('../assets/train-with-me-logo.png', import.meta.url).href;

export default function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><img className="brand-logo" src={logoUrl} alt="Train with me" width="1254" height="1254" /></div>;
}
