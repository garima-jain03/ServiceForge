const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function run() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', 'src', 'server.js')],
  });

  const client = new Client({ name: 'technician-availability-test', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('tools/list ->', tools.tools.map((t) => t.name));

  const technicianId = 1;
  console.log('calling get_technician_availability with ->', { technicianId });
  const result = await client.callTool({ name: 'get_technician_availability', arguments: { technicianId } });

  if (result.isError) {
    console.log('tools/call get_technician_availability -> isError:', result.isError, result.content[0].text);
  } else {
    // server returns a json payload in content[0].json
    const payload = result.content[0].json || result.content[0].text;
    console.log('tools/call get_technician_availability ->', JSON.stringify(payload, null, 2));
  }

  await client.close();
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exitCode = 1;
});
