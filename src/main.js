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
      const { name, environments } = repo
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

      // Handle environment creation or update
      if (environments) {
        for (const environment of environments) {
          const { environment_name, deployment_branch_policy } = environment

          core.info(`Processing environment: ${environment_name}`)

          try {
            // Log the API call to create or update the environment
            core.debug(
              `Calling createOrUpdateEnvironment API for ${owner}/${repoName}: ${environment_name}`
            )
            await octokit.rest.repos.createOrUpdateEnvironment({
              owner: owner,
              repo: repoName,
              environment_name: environment_name,
              deployment_branch_policy: deployment_branch_policy
            })
            core.info(`Environment ${environment_name} created/updated successfully.`)
          } catch (err) {
            core.error(`Failed to create/update environment ${environment_name}: ${err.message}`)
          }

          // Handle environment-scoped variables
          if (environment.variables) {
            for (const variable of environment.variables) {
              const { name, value } = variable

              core.info(`Processing environment variable: ${name}`)

              try {
                // Log the API call to get the existing environment variable
                core.debug(
                  `Calling getEnvironmentVariable API for ${owner}/${repoName}: ${environment_name} - ${name}`
                )
                try {
                  const { data: existingVar } =
                    await octokit.rest.actions.getEnvironmentVariable({
                      owner: owner,
                      repo: repoName,
                      environment_name: environment_name,
                      name: name
                    })

                  core.info(`Environment variable ${name} already exists. Updating...`)

                  // Log the API call to update the existing environment variable
                  core.debug(
                    `Calling updateEnvironmentVariable API for ${owner}/${repoName}: ${environment_name} - ${name} with value ${value}`
                  )
                  await octokit.rest.actions.updateEnvironmentVariable({
                    owner: owner,
                    repo: repoName,
                    environment_name: environment_name,
                    name: name,
                    value: value
                  })
                  core.info(`Environment variable ${name} updated successfully.`)
                } catch (err) {
                  // If the variable doesn't exist (404), create it
                  if (err.status === 404) {
                    core.info(`Environment variable ${name} not found. Creating...`)

                    // Log the API call to create a new environment variable
                    core.debug(
                      `Calling createEnvironmentVariable API for ${owner}/${repoName}: ${environment_name} - ${name} with value ${value}`
                    )
                    await octokit.rest.actions.createEnvironmentVariable({
                      owner: owner,
                      repo: repoName,
                      environment_name: environment_name,
                      name: name,
                      value: value
                    })
                    core.info(`Environment variable ${name} created successfully.`)
                  } else {
                    core.error(
                      `Failed to fetch/update environment variable ${name}: ${err.message}`
                    )
                  }
                }
              } catch (err) {
                core.error(`Failed to create/update environment variable ${name}: ${err.message}`)
              }
            }
          }
        }
      }

      // Iterate over the repository variables (as before)
      for (const variable of repo.variables) {
        const { name, value } = variable

        core.info(`Processing repository variable: ${name}`)

        try {
          // Log the API call to get the existing variable
          core.debug(
            `Calling getRepoVariable API for ${owner}/${repoName}: ${name}`
          )
          try {
            const { data: existingVar } =
              await octokit.rest.actions.getRepoVariable({
                owner: owner,
                repo: repoName,
                name: name
              })

            core.info(`Variable ${name} already exists. Updating...`)

            // Log the API call to update the existing variable
            core.debug(
              `Calling updateRepoVariable API for ${owner}/${repoName}: ${name} with value ${value}`
            )
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

              // Log the API call to create a new variable
              core.debug(
                `Calling createRepoVariable API for ${owner}/${repoName}: ${name} with value ${value}`
              )
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
