// The model may extract facts and choose presentation, but never supplies the final numbers or program names.
export const intakeSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    role: { enum: ['tenant', 'renting_landlord', 'owner_occupant_landlord', 'condo_owner', null] },
    town: { type: ['string', 'null'] },
    units: { enum: [2, 3, 4, null] },
    fuel: { enum: ['oil', 'natural_gas', 'propane', 'electric_resistance', 'heat_pump', 'other', null] },
    heatPayer: { enum: ['owner', 'tenant', null] },
    electricPayer: { enum: ['owner', 'tenant', null] },
    electricUtility: { enum: ['eversource', 'national_grid', 'unitil', 'cape_light_compact', 'municipal', null] },
  },
  required: ['role', 'town', 'units', 'fuel', 'heatPayer', 'electricPayer', 'electricUtility'],
}
export const presentationSchema = {
  type: 'object', additionalProperties: false,
  properties: { focus: { enum: ['cost', 'coordination'] }, tone: { enum: ['warm', 'direct'] } },
  required: ['focus', 'tone'],
}

export function validate(value, schema) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === schema.required.length && schema.required.every(key => {
    if (!Object.hasOwn(value, key)) return false
    const v = value[key], rule = schema.properties[key]
    if (rule.enum) return rule.enum.includes(v)
    return v === null || (typeof v === 'string' && v.length > 0 && v.length <= 80 && /^[a-zA-Z .'-]+$/.test(v))
  })
}

export async function askDeepSeek(kind, text, key, model, request = fetch) {
  const schema = kind === 'intake' ? intakeSchema : presentationSchema
  const instruction = kind === 'intake'
    ? 'Extract only facts explicitly stated by the user. Use null for anything unknown or ambiguous. For fuel and payers, provide a value only if the user explicitly says it applies to every floor. If tenants pay their own electric bills, that does not establish who pays the owner-occupied floor: use null unless every floor has the same stated payer. An owner living in a single-family home is not necessarily a landlord: use null for role unless renting out a unit is stated. Do not infer town, role, unit count, utilities or who pays from context. Town must be a Massachusetts city or town, not a street address.'
    : 'Choose the focus and tone that best suit the user request. You are selecting from fixed text, not writing facts or advice.'
  const example = kind === 'intake'
    ? { role: null, town: null, units: null, fuel: null, heatPayer: null, electricPayer: null, electricUtility: null }
    : { focus: 'cost', tone: 'warm' }
  const system = `${instruction} Return only a JSON object matching this schema: ${JSON.stringify(schema)}. Example JSON: ${JSON.stringify(example)}`
  const response = await request('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 400, thinking: { type: 'disabled' }, messages: [{ role: 'system', content: system }, { role: 'user', content: text }], response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    console.error(`Model service returned HTTP ${response.status}`)
    throw new Error('Model service unavailable')
  }
  const result = await response.json()
  const choice = result.choices?.[0]
  if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim()) throw new Error('Model did not return a complete answer')
  const value = JSON.parse(choice.message.content)
  if (!validate(value, schema)) throw new Error('Model returned an invalid answer')
  if (kind === 'intake' && value.role === 'owner_occupant_landlord') {
    if (value.heatPayer === 'tenant') value.heatPayer = null
    if (value.electricPayer === 'tenant') value.electricPayer = null
  }
  return value
}
