const core = require('@actions/core')
const github = require('@actions/github')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const token = core.getInput('token') || process.env.GITHUB_TOKEN
    const octokit = github.getOctokit(token)

    if (!token) {
      throw new Error('No github token provided')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
