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

    core.info('YAML configuration received. Parsing it...')
    // Parse the YAML string
    const config = yaml.load(yamlConfig)

    core.info('Parsed YAML configuration:')
    core.debug(JSON.stringify(config, null, 2)) // This will print the full config for debugging

    // Iterate over each repository and its variables
    for (const repo of config.repos) {
      const { name } = repo
      const [owner, repoName] = name.split('/') // Split the name into owner and repo

      core.info(`Processing repository ${owner}/${repoName}`)

      // Ensure the repository is valid
      try {
        const { data: repository } = await octokit.rest.repos.get({
          owner: owner,
          repo: repoName
        })
        core.info(
          `Repository ${owner}/${repoName} found: ${repository.full_name}`
        )
      } catch (err) {
        core.warning(
          `Repository ${owner}/${repoName} not found: ${err.message}`
        )
        continue
      }

      // Iterate over the variables and create or update them
      for (const variable of repo.variables) {
        const { name, value } = variable

        core.info(`Processing variable: ${name}`)

        try {
          // Attempt to get the repository variable to check if it exists
          try {
            const { data: existingVar } =
              await octokit.rest.actions.getRepoVariable({
                owner: owner,
                repo: repoName,
                name: name
              })

            core.info(`Variable ${name} already exists. Updating...`)

            // If it exists, update the variable
            await octokit.rest.actions.updateRepoVariable({
              owner: owner,
              repo: repoName,
              name: name,
              value: value
            })
            core.info(`Variable ${name} updated successfully.`)
          } catch (err) {
            // If the variable doesn't exist (404), create it
            if (err.status === 404) {
              core.info(`Variable ${name} not found. Creating...`)
              await octokit.rest.actions.createRepoVariable({
                owner: owner,
                repo: repoName,
                name: name,
                value: value
              })
              core.info(`Variable ${name} created successfully.`)
            } else {
              core.error(
                `Failed to fetch/update variable ${name}: ${err.message}`
              )
            }
          }
        } catch (err) {
          core.error(`Failed to create/update variable ${name}: ${err.message}`)
        }
      }
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`)
  }
}

module.exports = {
  run
}
