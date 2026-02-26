export default class CoreModules {
  async run () {
    this.manualFile = 'coremodules.md'
    this.replace = {
      VERSION: this.app.pkg.version,
      MODULES: this.generateMd()
    }
  }

  generateMd () {
    return Object.keys(this.app.dependencies).sort().reduce((s, name) => {
      const { version, description, homepage } = this.app.dependencies[name]
      const workflows = ['tests', 'standardjs']
      const badges = homepage
        ? workflows.map(w => `[![${w}](${homepage}/actions/workflows/${w}.yml/badge.svg)](${homepage}/actions/workflows/${w}.yml)`).join('<br>')
        : ''
      return `${s}\n| ${homepage ? `[${name}](${homepage})` : name} | ${version} | ${description} | ${badges} |`
    }, '| Name | Version | Description | Status |\n| - | :-: | - | :-: |')
  }
}
