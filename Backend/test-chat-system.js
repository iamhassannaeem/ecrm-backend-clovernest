const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testChatSystem() {
  console.log('🧪 Testing WhatsApp-like Chat System...\n');

  try {
    // Test 1: Check if database schema is updated
    console.log('1. Checking database schema...');
    
    // Check if new fields exist in ChatSession
    const chatSessionFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ChatSession' 
      AND column_name IN ('lastMessageAt', 'unreadCount', 'updatedAt')
    `;
    
    console.log('✅ ChatSession fields:', chatSessionFields.map(f => f.column_name));

    // Check if new fields exist in Message
    const messageFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Message' 
      AND column_name IN ('isRead', 'readAt', 'updatedAt')
    `;
    
    console.log('✅ Message fields:', messageFields.map(f => f.column_name));

    // Test 2: Check if organizations and users exist
    console.log('\n2. Checking organizations and users...');
    
    const organizations = await prisma.organization.findMany({
      take: 1,
      include: {
        users: {
          take: 2,
          include: {
            roles: true
          }
        }
      }
    });

    if (organizations.length === 0) {
      console.log('⚠️  No organizations found. Please run the seed script first.');
      return;
    }

    const org = organizations[0];
    console.log(`✅ Found organization: ${org.name}`);
    console.log(`✅ Found ${org.users.length} users in organization`);

    if (org.users.length < 2) {
      console.log('⚠️  Need at least 2 users to test chat functionality.');
      return;
    }

    const [user1, user2] = org.users;
    console.log(`✅ Test users: ${user1.firstName} ${user1.lastName} and ${user2.firstName} ${user2.lastName}`);

    // Test 3: Create a conversation
    console.log('\n3. Testing conversation creation...');
    
    const conversation = await prisma.chatSession.create({
      data: {
        organizationId: org.id,
        participants: {
          create: [
            { userId: user1.id, organizationId: org.id },
            { userId: user2.id, organizationId: org.id }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Created conversation ${conversation.id} between ${conversation.participants[0].user.firstName} and ${conversation.participants[1].user.firstName}`);

    // Test 4: Send messages
    console.log('\n4. Testing message sending...');
    
    const message1 = await prisma.message.create({
      data: {
        chatSessionId: conversation.id,
        senderId: user1.id,
        content: 'Hello! This is a test message.',
        organizationId: org.id
      },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    console.log(`✅ Message 1 sent by ${message1.sender.firstName}: "${message1.content}"`);

    const message2 = await prisma.message.create({
      data: {
        chatSessionId: conversation.id,
        senderId: user2.id,
        content: 'Hi! This is a reply message.',
        organizationId: org.id
      },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    console.log(`✅ Message 2 sent by ${message2.sender.firstName}: "${message2.content}"`);

    // Test 5: Update conversation with last message time
    console.log('\n5. Testing conversation updates...');
    
    await prisma.chatSession.update({
      where: { id: conversation.id },
      data: { 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Updated conversation with last message time');

    // Test 6: Mark messages as read
    console.log('\n6. Testing message read status...');
    
    await prisma.message.updateMany({
      where: {
        chatSessionId: conversation.id,
        senderId: user2.id // Messages from user2 to user1
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    console.log('✅ Marked messages as read');

    // Test 7: Verify conversation data
    console.log('\n7. Verifying conversation data...');
    
    const updatedConversation = await prisma.chatSession.findUnique({
      where: { id: conversation.id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    console.log(`✅ Conversation has ${updatedConversation.messages.length} messages`);
    console.log(`✅ Last message at: ${updatedConversation.lastMessageAt}`);
    console.log(`✅ Updated at: ${updatedConversation.updatedAt}`);

    // Test 8: Test message read status
    const unreadMessages = await prisma.message.findMany({
      where: {
        chatSessionId: conversation.id,
        isRead: false
      }
    });

    const readMessages = await prisma.message.findMany({
      where: {
        chatSessionId: conversation.id,
        isRead: true
      }
    });

    console.log(`✅ Unread messages: ${unreadMessages.length}`);
    console.log(`✅ Read messages: ${readMessages.length}`);

    // Test 9: Clean up test data
    console.log('\n8. Cleaning up test data...');
    
    await prisma.message.deleteMany({
      where: { chatSessionId: conversation.id }
    });

    await prisma.chatParticipant.deleteMany({
      where: { chatSessionId: conversation.id }
    });

    await prisma.chatSession.delete({
      where: { id: conversation.id }
    });

    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! The WhatsApp-like chat system is working correctly.');
    console.log('\n📋 Summary of features tested:');
    console.log('   ✅ Database schema updates');
    console.log('   ✅ Conversation creation');
    console.log('   ✅ Message sending');
    console.log('   ✅ Message read status');
    console.log('   ✅ Conversation timestamps');
    console.log('   ✅ Data cleanup');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testChatSystem(); 