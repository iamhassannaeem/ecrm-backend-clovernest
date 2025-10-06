const io = require('socket.io-client');

// Test Socket.IO connection
async function testSocketConnection() {
    console.log('🔌 Testing Socket.IO connection...');
    
    // Replace with a valid JWT token from your system
    const token = 'YOUR_JWT_TOKEN_HERE';
    
    if (token === 'YOUR_JWT_TOKEN_HERE') {
        console.log('❌ Please replace YOUR_JWT_TOKEN_HERE with a valid JWT token');
        console.log('💡 You can get a token by logging into your system');
        return;
    }
    
    try {
        const socket = io('http://localhost:3001', {
            auth: { token: token },
            transports: ['websocket', 'polling'],
            timeout: 20000
        });
        
        socket.on('connect', () => {
            console.log('✅ Socket connected successfully!');
            console.log('🔗 Socket ID:', socket.id);
            
            // Test joining a group chat
            socket.emit('joinGroupChat', '1');
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
        });
        
        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
        });
        
        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });
        
        socket.on('groupChatLoaded', (data) => {
            console.log('✅ Group chat loaded:', data);
        });
        
        // Test sending a group message
        setTimeout(() => {
            if (socket.connected) {
                console.log('📨 Testing group message...');
                socket.emit('sendGroupMessage', {
                    groupId: '1',
                    content: 'Test message from script',
                    messageType: 'text'
                });
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error creating socket:', error);
    }
}

// Test API endpoints
async function testAPIEndpoints() {
    console.log('\n📡 Testing API endpoints...');
    
    const token = 'YOUR_JWT_TOKEN_HERE';
    
    if (token === 'YOUR_JWT_TOKEN_HERE') {
        console.log('❌ Please replace YOUR_JWT_TOKEN_HERE with a valid JWT token');
        return;
    }
    
    const baseUrl = 'http://localhost:3001/api/chat';
    
    try {
        // Test getting groups
        console.log('📡 Testing GET /api/chat/groups...');
        const groupsResponse = await fetch(`${baseUrl}/groups`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Groups response status:', groupsResponse.status);
        
        if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json();
            console.log('✅ Groups loaded successfully:', groupsData.success);
            if (groupsData.success && groupsData.data) {
                console.log(`📊 Found ${groupsData.data.length} groups`);
            }
        } else {
            const errorText = await groupsResponse.text();
            console.log('❌ Groups response error:', errorText);
        }
        
        // Test creating a group
        console.log('\n📡 Testing POST /api/chat/groups/create...');
        const createResponse = await fetch(`${baseUrl}/groups/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: 'Test Group',
                description: 'Test group created by script',
                userIds: [1, 2] // Replace with valid user IDs
            })
        });
        
        console.log('📡 Create group response status:', createResponse.status);
        
        if (createResponse.ok) {
            const createData = await createResponse.json();
            console.log('✅ Group created successfully:', createData.success);
        } else {
            const errorText = await createResponse.text();
            console.log('❌ Create group response error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ API test error:', error.message);
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Group Chat Connection Test Script\n');
    
    await testSocketConnection();
    await testAPIEndpoints();
    
    console.log('\n✅ Tests completed!');
    console.log('\n💡 To use this script:');
    console.log('1. Replace YOUR_JWT_TOKEN_HERE with a valid JWT token');
    console.log('2. Make sure your server is running on port 3001');
    console.log('3. Update the user IDs in the create group test');
}

runTests().catch(console.error);
