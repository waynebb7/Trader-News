class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return true;
  }

  getStatus() {
    return {
      name: this.name,
      status: this.isConfigured() ? 'ready' : 'missing-key',
      message: this.isConfigured() ? 'Configured' : 'API key not configured — using fallback'
    };
  }
}

module.exports = BaseAdapter;
