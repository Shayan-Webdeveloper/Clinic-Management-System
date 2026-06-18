// Authentication module

const Auth = {
  currentUser: null,
  profile: null,

  async init() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
    }
    sb.auth.onAuthStateChange(async (event, session) => {
      this.currentUser = session?.user || null;
      if (session) await this.loadProfile();
      else this.profile = null;
    });
    return session;
  },

  async loadProfile() {
    if (!this.currentUser) return null;
    const sb = getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', this.currentUser.id)
      .single();
    if (error) console.error('Profile load error:', error);
    this.profile = data;
    return data;
  },

  async signIn(email, password) {
    Utils.showLoading(true);
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    Utils.showLoading(false);
    if (error) throw error;
    this.currentUser = data.user;
    await this.loadProfile();
    return data;
  },

  async signUp(email, password, fullName, role = 'admin') {
    Utils.showLoading(true);
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    });
    Utils.showLoading(false);
    if (error) throw error;
    return data;
  },

  async signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    this.currentUser = null;
    this.profile = null;
    window.location.href = 'index.html';
  },

  async resetPassword(email) {
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
    if (error) throw error;
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  hasRole(...roles) {
    return roles.includes(this.profile?.role);
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};
