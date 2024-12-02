const core = require('@actions/core')
const github = require('@actions/github')
const yaml = require('js-yaml')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const token = core.getInput('token') || process.env.GITHUB_TOKEN
    const octokit = github.getOctokit(token)

    if (!token) {
      throw new Error('No GitHub token provided')
    }

    // Get the YAML content passed via the workflow input
    const yamlConfig = core.getInput('yaml-config')
    if (!yamlConfig) {
      throw new Error('No config YAML provided')
    }

    // Parse the YAML string
    const config = yaml.load(yamlConfig)

    // Iterate over each repository and its variables
    for (const repo of config.repos) {
      const { owner, repo: repoName } = github.context.repo

      // Ensure the repository is valid
      const { data: repository } = await octokit.rest.repos.get({
        owner: owner,
        repo: repoName
      })

      console.log(`Processing repository: ${repoName}`)

      // Iterate over the variables and create or update them
      for (const variable of repo.variables) {
        const { name, value } = variable

        try {
          // Attempt to get the repository variable to check if it exists
          try {
            const { data: existingVar } =
              await octokit.rest.actions.getRepoVariable({
                owner: owner,
                repo: repoName,
                name: name
              })

            // If it exists, update the variable
            await octokit.rest.actions.updateRepoVariable({
              owner: owner,
              repo: repoName,
              name: name,
              value: value
            })
            console.log(`Variable ${name} updated successfully.`)
          } catch (err) {
            // If the variable doesn't exist (404), create it
            if (err.status === 404) {
              await octokit.rest.actions.createRepoVariable({
                owner: owner,
                repo: repoName,
                name: name,
                value: value
              })
              console.log(`Variable ${name} created successfully.`)
            } else {
              console.error(
                `Failed to fetch/update variable ${name}:`,
                err.message
              )
            }
          }
        } catch (err) {
          console.error(
            `Failed to create/update variable ${name}:`,
            err.message
          )
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
