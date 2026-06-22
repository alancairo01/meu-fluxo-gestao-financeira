export async function getRuntimeConfig() {
  const response = await fetch('/runtime-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do sistema.');
  const config = await response.json();
  return {
    configured: Boolean(config.configured),
    supabaseUrl: String(config.supabaseUrl || ''),
    supabasePublishableKey: String(config.supabasePublishableKey || '')
  };
}
