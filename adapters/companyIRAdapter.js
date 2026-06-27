const BaseAdapter = require('./baseAdapter');
const mockAdapter = require('./mockAdapter');

class CompanyIRAdapter extends BaseAdapter {
  constructor() {
    super('companyIR');
  }

  isConfigured() {
    return true;
  }

  async getCompanyIR(instrument) {
    if (!instrument.irUrl) {
      return { irUrl: null, items: [], message: 'No IR URL configured for this instrument' };
    }

    return mockAdapter.getCompanyIR(instrument);
  }

  getStatus() {
    return { name: 'companyIR', status: 'ready', message: 'IR links + sample releases (extend with RSS)' };
  }
}

module.exports = new CompanyIRAdapter();
