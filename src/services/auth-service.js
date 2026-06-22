import { getRuntimeConfig } from './runtime-config-service.js';

export class AuthService {
  constructor() {
    this.client = null;
    this.config = null;
  }

  async initialize() {
    this.config = await getRuntimeConfig();
    if (!this.config.configured) return this.config;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.client = createClient(this.config.supabaseUrl, this.config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return this.config;
  }

  getClient() {
    if (!this.client) throw new Error('A conexão com o Supabase ainda não foi configurada.');
    return this.client;
  }

  async getSession() {
    const { data, error } = await this.getClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(callback) {
    return this.getClient().auth.onAuthStateChange(callback);
  }

  async signIn(email, password) {
    const { data, error } = await this.getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signUp(email, password) {
    const { data, error } = await this.getClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });
    if (error) throw error;
    return data;
  }

  async sendPasswordReset(email) {
    const { error } = await this.getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    });
    if (error) throw error;
  }

  async updatePassword(password) {
    const { error } = await this.getClient().auth.updateUser({ password });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.getClient().auth.signOut();
    if (error) throw error;
  }
}
