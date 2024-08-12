# Create agents that communicate to each other and have long term memory

- Communication replies on Valkey pub/sub
- Persistent short memory storage uses Apache Kafka topics
- Long term memory relies on RAG, langchain, OpenSearch and Apache Kafka

## Step 1: Deploy Aiven services with Terraform

### Register with Aiven
If you don't have Aiven account yet, [register here](https://go.aiven.io/aws-agents-workshop) to get extra credits.

### Get Aiven token
In Aiven console Go to **User Information** menu and select **Tokens**:
![tokens.png](screenshots%2Ftokens.png)

Click on **Generate token**, add a description for the token and press to generate. A popup with a newly generated token will appear. Copy token value.

### Run Terraform script
In this project we use Terraform to set up Aiven services. If you don't have Terraform installed follow the steps from [the Terraform documentation page](https://developer.hashicorp.com/terraform/install).

The terraform files can be found in `./terraform` folder of the current project.
`./terraform/terraform.tfvars-example` provides an example of *tfvars* file. 

1. Rename (or create a new file) to `./terraform/terraform.tfvars`.
2. Populate aiven_api_token with the token that you copied from the console.
3. Populate project_name with the name of the Aiven project.
4. Navigate to `terraform` folder
5. Set `export PROVIDER_AIVEN_ENABLE_BETA=true` in the terminal (Terraform Valkey resource is still in beta stage).
6. Run `terraform init`.
7. Run `terraform plan`.
8. Run `terraform apply`.

Terraform will initiate creation of four resources:
- Aiven for Apache Kafka
- Apache Kafka topic
- Aiven for OpenSearch
- Aiven for caching (Valkey)

Once deployment is done, Terraform will also create `.env` file with necessary credentials to access the services.

## Step 2: Enable Amazon Bedrock model Claude
In this project we use LLM Claude available through Amazon Bedrock.
To invoke the model you need first to enable access:

1. In AWS console select region where Amazon Bedrock and Claude model is available (for example, `us-east-1`).
2. Go to Amazon Bedrock service page.
3. Select **Providers** in the menu and then Anthropic, scroll to the **Claude models**.
![aws-providers.png](screenshots%2Faws-providers.png)
4. In this project we use **Claude 3 Haiku**, you can also select a different model, but that might require changes in request/response formats.
5. If you see a message `This account does not currently have access to this model. Request access in Model access.`, go to Model access and enable the model.

### AWS credentials
This project assumes that AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID are accessible through the environment variables. Follow [AWS documentation](https://docs.aws.amazon.com/keyspaces/latest/devguide/access.credentials.html) for more details.

Context: the credentials are used by `@aws-sdk/client-bedrock-runtime` when creating a client, see Bedrock client creation in `./src/common.js` for details.

## Step 3: Install libraries
This project uses npm and NodeJS, if you don't have them installed, follow instruction at [the NodeJS documentation page](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)
Run
``npm install``

## Step 4: Run locally
Run
``node run``






