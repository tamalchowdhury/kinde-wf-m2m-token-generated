import {
  onM2MTokenGeneratedEvent,
  WorkflowSettings,
  WorkflowTrigger,
  createKindeAPI,
  m2mTokenClaims,
} from "@kinde/infrastructure"

export const workflowSettings: WorkflowSettings = {
  id: "m2mTokenGeneration",
  name: "M2M custom claims",
  failurePolicy: {
    action: "stop",
  },
  trigger: WorkflowTrigger.M2MTokenGeneration,
  bindings: {
    "kinde.m2mToken": {}, // required to modify M2M access token
    "kinde.fetch": {}, // Required for API calls
    "kinde.env": {}, // required to access your environment variables
    url: {}, // required for url params
  },
}

export default async function Workflow(event: onM2MTokenGeneratedEvent) {
  // Get a token for Kinde management API
  const kindeAPI = await createKindeAPI(event)

  const { clientId } = event.context.application

  // Call Kinde applications properties API
  const { data } = await kindeAPI.get({
    endpoint: `applications/${clientId}/properties`,
  })
  const properties = data?.properties ?? []

  // Get the org code property to make the correlation
  const orgProp = properties.find((p: any) => p.key === "org_code")
  if (!orgProp?.value) {
    throw new Error("Missing org_code application property")
  }

  // Get org data from Kinde management API
  const { data: orgsData } = await kindeAPI.get({
    endpoint: "organizations",
  })

  const organizations =
    orgsData?.data?.organizations ?? orgsData?.organizations ?? []
  const org = organizations.find((o: any) => o.code === orgProp.value)
  if (!org) {
    throw new Error(`No organization found with code '${orgProp.value}'.`)
  }

  // set up types for the custom claims
  const m2mToken = m2mTokenClaims<{
    applicationId: string
    orgName: string
    orgCode: string
  }>()

  // Use the data to set the org data on the M2M token
  m2mToken.applicationId = clientId
  m2mToken.orgName = org.name
  m2mToken.orgCode = org.code
}
