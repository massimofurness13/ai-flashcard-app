"""Fail the archive before signing if assets use a placeholder/wrong environment."""
import sys,json,hashlib,re
from pathlib import Path

def verify(root):
    manifest=json.loads((root/'huella-release.json').read_text())
    assert manifest['supabaseUrl']=='https://fghxwycixcawwtctknmp.supabase.co', 'Wrong Supabase project'
    assert manifest['appUrl']=='https://flashmind-35q4.onrender.com', 'Wrong app origin'
    assets=manifest['assets'];assert assets, 'No bundled JavaScript'
    seen=set()
    for item in assets:
        path=(root/item['file']).resolve()
        assert path.is_relative_to(root.resolve()), 'Invalid asset path'
        data=path.read_bytes()
        assert hashlib.sha256(data).hexdigest()==item['sha256'], 'Stale/changed asset'
        hosts=set(re.findall(rb'https://([a-z0-9-]+\.supabase\.co)',data))
        assert hosts <= {b'fghxwycixcawwtctknmp.supabase.co'}, 'Non-production Supabase in bundle'
        seen |= hosts
    assert seen, 'Production Supabase origin missing from bundle'
    expected={item['file'] for item in assets}
    assert {str(p.relative_to(root)) for p in (root/'assets').glob('*.js') if not p.name.startswith('pdf.worker.')}==expected, 'Unverified/stale JavaScript files'
    return len(assets)

if __name__=='__main__':
    try:print('Verified production native bundle:',verify(Path(sys.argv[1])),'JavaScript files')
    except Exception as error:
        print('Native archive blocked: rebuild with production settings using npm run ios:sync. '+str(error),file=sys.stderr);sys.exit(1)
