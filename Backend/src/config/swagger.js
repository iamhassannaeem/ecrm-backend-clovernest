const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SaaS Backend API',
      version: '1.0.0',
      description: 'Short description: Multi-tenant SaaS backend API. See endpoints below.',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://your-api-domain.com'
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer YOUR_TOKEN_HERE'
        }
      },
      parameters: {
        organizationId: {
          name: 'organizationId',
          in: 'path',
          required: true,
          description: 'Organization ID',
          schema: {
            type: 'string',
            example: 'cm123abc456def789'
          }
        },
        userId: {
          name: 'userId',
          in: 'path',
          required: true,
          description: 'User ID',
          schema: {
            type: 'string',
            example: 'cm123abc456def789'
          }
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
            example: 1
          }
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
            example: 10
          }
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cm123abc456def789',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              example: 'John',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              example: 'Doe',
              description: 'User last name'
            },
            avatar: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/avatars/john-doe.jpg',
              description: 'User avatar URL'
            },
            emailVerified: {
              type: 'boolean',
              example: true,
              description: 'Whether user email is verified'
            },
            isActive: {
              type: 'boolean',
              example: true,
              description: 'Whether user account is active'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
              description: 'Account creation timestamp'
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T14:45:30.000Z',
              description: 'Last login timestamp'
            }
          }
        },
        Organization: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cm456def789ghi012',
              description: 'Unique organization identifier'
            },
            name: {
              type: 'string',
              example: 'Acme Corporation',
              description: 'Organization name'
            },
            slug: {
              type: 'string',
              example: 'acme-corporation',
              description: 'URL-friendly organization identifier'
            },
            domain: {
              type: 'string',
              example: 'acme-corp.com',
              description: 'Organization domain name (unique)'
            },
            description: {
              type: 'string',
              example: 'A leading technology company specializing in innovative solutions',
              description: 'Organization description'
            },
            logo: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/logos/acme-corp.png',
              description: 'Organization logo URL'
            },
            website: {
              type: 'string',
              format: 'uri',
              example: 'https://acme-corp.com',
              description: 'Organization website URL'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'],
              example: 'ACTIVE',
              description: 'Organization status'
            },
            trialEndsAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-02-15T23:59:59.000Z',
              description: 'Trial period end date (if applicable)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T09:00:00.000Z',
              description: 'Organization creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-18T16:30:00.000Z',
              description: 'Last update timestamp'
            }
          }
        },
        OrganizationUser: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            role: {
              type: 'string',
              enum: ['ORGANIZATION_ADMIN', 'USER'],
              example: 'ORGANIZATION_ADMIN'
            },
            joinedAt: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean', example: true },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            stripeSubscriptionId: { type: 'string', example: 'sub_1234567890' },
            stripePriceId: { type: 'string', example: 'price_1234567890' },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'CANCELLED', 'PAST_DUE', 'UNPAID', 'TRIALING'],
              example: 'ACTIVE'
            },
            currentPeriodStart: { type: 'string', format: 'date-time' },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
            cancelAtPeriodEnd: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            stripePaymentId: { type: 'string', example: 'pi_1234567890' },
            amount: { type: 'integer', example: 2999, description: 'Amount in cents' },
            currency: { type: 'string', example: 'usd' },
            status: { type: 'string', example: 'succeeded' },
            description: { type: 'string', example: 'Monthly subscription' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            action: { type: 'string', example: 'CREATE_ORGANIZATION' },
            resource: { type: 'string', example: 'ORGANIZATION' },
            resourceId: { type: 'string' },
            oldValues: { type: 'object' },
            newValues: { type: 'object' },
            ipAddress: { type: 'string', example: '192.168.1.1' },
            userAgent: { type: 'string' },
            userRole: { type: 'string', example: 'ORGANIZATION_ADMIN', description: 'User role at time of action' },
            systemRole: { type: 'string', example: 'SUPER_ADMIN', description: 'System role if applicable' },
            createdAt: { type: 'string', format: 'date-time' },
            user: { $ref: '#/components/schemas/User' },
            organization: { $ref: '#/components/schemas/Organization' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation failed',
              description: 'Error message'
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
              description: 'Error code for programmatic handling'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email format' }
                }
              },
              description: 'Detailed validation errors'
            }
          },
          example: {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: [
              {
                field: 'email',
                message: 'Invalid email format'
              },
              {
                field: 'password',
                message: 'Password must be at least 8 characters'
              }
            ]
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Operation completed successfully',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {},
              description: 'Array of items'
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 10 },
                total: { type: 'integer', example: 25 },
                totalPages: { type: 'integer', example: 3 },
                hasNext: { type: 'boolean', example: true },
                hasPrev: { type: 'boolean', example: false }
              }
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            timestamp: { type: 'string', format: 'date-time', example: '2024-01-20T15:30:00.000Z' },
            uptime: { type: 'number', example: 3600.5, description: 'Server uptime in seconds' },
            environment: { type: 'string', example: 'development' }
          }
        },
        OrganizationDashboard: {
          type: 'object',
          properties: {
            organization: {
              $ref: '#/components/schemas/Organization'
            },
            analytics: {
              type: 'object',
              properties: {
                memberStats: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 25, description: 'Total members' },
                    admins: { type: 'integer', example: 3, description: 'Organization admins' },
                    members: { type: 'integer', example: 15, description: 'Organization members' },
                    users: { type: 'integer', example: 7, description: 'Regular users' },
                    activeToday: { type: 'integer', example: 12, description: 'Members active today' },
                    newThisMonth: { type: 'integer', example: 5, description: 'New members this month' }
                  }
                },
                activityStats: {
                  type: 'object',
                  properties: {
                    totalActions: { type: 'integer', example: 150, description: 'Total audit log actions' },
                    todayActions: { type: 'integer', example: 25, description: 'Actions today' },
                    weekActions: { type: 'integer', example: 85, description: 'Actions this week' }
                  }
                },
                subscription: {
                  allOf: [
                    { $ref: '#/components/schemas/Subscription' },
                    {
                      type: 'object',
                      properties: {
                        trialEnd: { type: 'string', format: 'date-time', description: 'Trial end date' }
                      }
                    }
                  ]
                },
                recentActivity: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/AuditLog'
                  },
                  description: 'Recent organization activity'
                }
              }
            }
          }
        },
        SuperAdminStats: {
          type: 'object',
          properties: {
            stats: {
              type: 'object',
              properties: {
                users: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 1250, description: 'Total users' },
                    active: { type: 'integer', example: 1180, description: 'Active users' },
                    newToday: { type: 'integer', example: 15, description: 'New users today' },
                    newThisWeek: { type: 'integer', example: 85, description: 'New users this week' },
                    newThisMonth: { type: 'integer', example: 320, description: 'New users this month' }
                  }
                },
                organizations: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 150, description: 'Total organizations' },
                    active: { type: 'integer', example: 142, description: 'Active organizations' },
                    trial: { type: 'integer', example: 25, description: 'Trial organizations' },
                    suspended: { type: 'integer', example: 3, description: 'Suspended organizations' },
                    newThisMonth: { type: 'integer', example: 12, description: 'New organizations this month' }
                  }
                },
                subscriptions: {
                  type: 'object',
                  properties: {
                    active: { type: 'integer', example: 125, description: 'Active subscriptions' },
                    trialing: { type: 'integer', example: 18, description: 'Trial subscriptions' },
                    pastDue: { type: 'integer', example: 5, description: 'Past due subscriptions' },
                    cancelled: { type: 'integer', example: 8, description: 'Cancelled subscriptions' }
                  }
                },
                revenue: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer', example: 125000, description: 'Total revenue in cents' },
                    thisMonth: { type: 'integer', example: 15000, description: 'This month revenue in cents' },
                    lastMonth: { type: 'integer', example: 12500, description: 'Last month revenue in cents' },
                    growth: { type: 'number', example: 20.5, description: 'Revenue growth percentage' }
                  }
                },
                activity: {
                  type: 'object',
                  properties: {
                    totalActions: { type: 'integer', example: 25000, description: 'Total platform actions' },
                    todayActions: { type: 'integer', example: 450, description: 'Actions today' },
                    weekActions: { type: 'integer', example: 2800, description: 'Actions this week' }
                  }
                }
              }
            }
          }
        },
        Permission: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm789pqr012stu345' },
            action: {
              type: 'string',
              enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'],
              example: 'READ',
              description: 'Permission action'
            },
            resource: {
              type: 'string',
              enum: ['USER', 'ORGANIZATION', 'SUBSCRIPTION', 'PAYMENT', 'ADMIN_PANEL'],
              example: 'USER',
              description: 'Resource type'
            },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' }
          }
        },
        PermissionAssignment: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'],
                    example: 'READ'
                  },
                  resource: {
                    type: 'string',
                    enum: ['USER', 'ORGANIZATION', 'SUBSCRIPTION', 'PAYMENT', 'ADMIN_PANEL'],
                    example: 'USER'
                  }
                }
              },
              example: [
                { action: 'READ', resource: 'USER' },
                { action: 'UPDATE', resource: 'USER' },
                { action: 'READ', resource: 'ADMIN_PANEL' }
              ]
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
              description: 'User email address'
            },
            password: {
              type: 'string',
              example: 'SecurePassword123!',
              description: 'User password (min 8 characters, must include uppercase, lowercase, number, special char)'
            }
          },
          example: {
            email: 'john.doe@example.com',
            password: 'SecurePassword123!'
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'organizationId'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'jane.smith@example.com',
              description: 'User email address (must be unique)'
            },
            password: {
              type: 'string',
              example: 'MySecurePass456!',
              description: 'Password (min 8 chars, uppercase, lowercase, number, special char)'
            },
            firstName: {
              type: 'string',
              example: 'Jane',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              example: 'Smith',
              description: 'User last name (optional)'
            },
            organizationId: {
              type: 'string',
              example: 'cm456def789ghi012',
              description: 'ID of organization to join'
            },
            message: {
              type: 'string',
              example: 'I would like to join your organization',
              description: 'Optional message to organization admin (max 500 chars)',
              maxLength: 500
            }
          },
          example: {
            email: 'jane.smith@example.com',
            password: 'MySecurePass456!',
            firstName: 'Jane',
            lastName: 'Smith',
            organizationId: 'cm456def789ghi012',
            message: 'I would like to join your organization'
          }
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTEyM2FiYzQ1NmRlZjc4OSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzA1NTc2ODAwLCJleHAiOjE3MDYxODE2MDB9.example',
              description: 'Refresh token received from login/register'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Login successful',
              description: 'Success message'
            },
            user: {
              allOf: [
                { $ref: '#/components/schemas/User' },
                {
                  type: 'object',
                  properties: {
                    organizations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'cm456def789ghi012' },
                          name: { type: 'string', example: 'Acme Corporation' },
                          slug: { type: 'string', example: 'acme-corporation' },
                          role: {
                            type: 'string',
                            enum: ['SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'ORG_MEMBER', 'USER'],
                            example: 'ORGANIZATION_ADMIN'
                          }
                        }
                      },
                      description: 'User organizations and roles'
                    },
                    joinRequests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: 'cm789join123req456' },
                          status: {
                            type: 'string',
                            enum: ['PENDING', 'APPROVED', 'REJECTED'],
                            example: 'PENDING'
                          },
                          requestedAt: { type: 'string', format: 'date-time' },
                          organization: {
                            type: 'object',
                            properties: {
                              id: { type: 'string', example: 'cm456def789ghi012' },
                              name: { type: 'string', example: 'Acme Corporation' },
                              domain: { type: 'string', example: 'acme-corp.com' }
                            }
                          }
                        }
                      },
                      description: 'User join requests status'
                    }
                  }
                }
              ]
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTEyM2FiYzQ1NmRlZjc4OSIsImlhdCI6MTcwNTU3NjgwMCwiZXhwIjoxNzA1NTc3NzAwfQ.example',
                  description: 'JWT access token (expires in 15 minutes)'
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbTEyM2FiYzQ1NmRlZjc4OSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzA1NTc2ODAwLCJleHAiOjE3MDYxODE2MDB9.example',
                  description: 'JWT refresh token (expires in 7 days)'
                }
              },
              description: 'Authentication tokens'
            }
          },
          example: {
            message: 'Login successful',
            user: {
              id: 'cm123abc456def789',
              email: 'john.doe@example.com',
              firstName: 'John',
              lastName: 'Doe',
              emailVerified: true,
              isActive: true,
              organizations: [
                {
                  id: 'cm456def789ghi012',
                  name: 'Acme Corporation',
                  slug: 'acme-corporation',
                  role: 'ORGANIZATION_ADMIN'
                }
              ]
            },
            tokens: {
              accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          }
        },
        CreateOrganizationRequest: {
          type: 'object',
          required: ['name', 'adminEmail', 'adminFirstName', 'adminPassword'],
          properties: {
            name: {
              type: 'string',
              example: 'TechStart Solutions',
              description: 'Organization name (1-100 characters)',
              minLength: 1,
              maxLength: 100
            },
            domain: {
              type: 'string',
              example: 'techstart.com',
              description: 'Organization domain (optional, can be any text including links)'
            },
            description: {
              type: 'string',
              example: 'A cutting-edge technology startup focused on AI solutions',
              description: 'Organization description (optional, max 500 characters)',
              maxLength: 500
            },
            website: {
              type: 'string',
              example: 'https://techstart-solutions.com',
              description: 'Organization website (optional, can be any text including links)'
            },
            adminEmail: {
              type: 'string',
              format: 'email',
              example: 'admin@techstart.com',
              description: 'Email for organization admin user'
            },
            adminFirstName: {
              type: 'string',
              example: 'John',
              description: 'Admin user first name',
              minLength: 1
            },
            adminLastName: {
              type: 'string',
              example: 'Admin',
              description: 'Admin user last name (optional)'
            },
            adminPassword: {
              type: 'string',
              example: 'AdminPass123!',
              description: 'Password for admin user (min 8 characters)',
              minLength: 8
            }
          },
          example: {
            name: 'TechStart Solutions',
            domain: 'techstart.com',
            description: 'A cutting-edge technology startup focused on AI solutions',
            website: 'https://techstart-solutions.com',
            adminEmail: 'admin@techstart.com',
            adminFirstName: 'John',
            adminLastName: 'Admin',
            adminPassword: 'AdminPass123!'
          }
        },
        UpdateOrganizationRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'TechStart Solutions Inc.',
              description: 'Updated organization name',
              minLength: 1,
              maxLength: 100
            },
            domain: {
              type: 'string',
              example: 'techstart.com',
              description: 'Updated organization domain (optional, can be any text including links)'
            },
            description: {
              type: 'string',
              example: 'A leading technology company specializing in AI and machine learning solutions',
              description: 'Updated organization description',
              maxLength: 500
            },
            website: {
              type: 'string',
              example: 'https://techstart-solutions.com',
              description: 'Updated organization website (optional, can be any text including links)'
            }
          }
        },
        InviteUserRequest: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'newuser@example.com',
              description: 'Email address of user to invite'
            },
            role: {
              type: 'string',
              enum: ['ORGANIZATION_ADMIN', 'ORG_MEMBER', 'USER'],
              example: 'ORG_MEMBER',
              description: 'Role to assign to the invited user'
            },
            message: {
              type: 'string',
              example: 'Welcome to our organization! We are excited to have you on board.',
              description: 'Optional custom message for the invitation email'
            }
          }
        },
        PlatformStats: {
          type: 'object',
          properties: {
            stats: {
              type: 'object',
              properties: {
                totalUsers: { type: 'integer', example: 150 },
                totalOrganizations: { type: 'integer', example: 25 },
                activeSubscriptions: { type: 'integer', example: 20 },
                totalRevenue: { type: 'integer', example: 50000, description: 'Total revenue in cents' },
                recentUsers: { type: 'integer', example: 10, description: 'New users in last 30 days' },
                recentOrganizations: { type: 'integer', example: 3, description: 'New organizations in last 30 days' }
              }
            }
          }
        },
        OrganizationJoinRequest: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cm789join123req456',
              description: 'Unique join request identifier'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
              example: 'PENDING',
              description: 'Join request status'
            },
            requestedRole: {
              type: 'string',
              enum: ['USER', 'ORG_MEMBER'],
              example: 'USER',
              description: 'Requested organization role'
            },
            message: {
              type: 'string',
              example: 'I would like to join your organization',
              description: 'Message from user to organization admin'
            },
            requestedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T10:30:00.000Z',
              description: 'When the request was made'
            },
            reviewedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-21T14:15:00.000Z',
              description: 'When the request was reviewed (if applicable)'
            },
            user: {
              $ref: '#/components/schemas/User'
            },
            organization: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'cm456def789ghi012' },
                name: { type: 'string', example: 'Acme Corporation' },
                domain: { type: 'string', example: 'acme-corp.com' },
                description: { type: 'string', example: 'A leading technology company' }
              }
            },
            reviewedBy: {
              type: 'object',
              properties: {
                firstName: { type: 'string', example: 'John' },
                lastName: { type: 'string', example: 'Admin' }
              }
            }
          }
        },
        AvailableOrganization: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'cm456def789ghi012',
              description: 'Organization identifier'
            },
            name: {
              type: 'string',
              example: 'Acme Corporation',
              description: 'Organization name'
            },
            domain: {
              type: 'string',
              example: 'acme-corp.com',
              description: 'Organization domain'
            },
            description: {
              type: 'string',
              example: 'A leading technology company',
              description: 'Organization description'
            }
          }
        },
        PermissionModule: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'User Management',
              description: 'Module name'
            },
            description: {
              type: 'string',
              example: 'Manage users, profiles, and roles within the organization',
              description: 'Module description'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'],
                    example: 'READ'
                  },
                  resource: {
                    type: 'string',
                    example: 'USER_MANAGEMENT'
                  },
                  description: {
                    type: 'string',
                    example: 'View user list and basic information'
                  }
                }
              }
            }
          }
        },
        PermissionTemplate: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Content Manager',
              description: 'Template name'
            },
            description: {
              type: 'string',
              example: 'Full access to content creation, editing, and publishing',
              description: 'Template description'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE']
                  },
                  resource: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        PermissionsDashboard: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                totalMembers: {
                  type: 'integer',
                  example: 25
                },
                membersWithCustomPermissions: {
                  type: 'integer',
                  example: 15
                },
                roleDistribution: {
                  type: 'object',
                  properties: {
                    ORGANIZATION_ADMIN: { type: 'integer', example: 2 },
                    ORG_MEMBER: { type: 'integer', example: 8 },
                    USER: { type: 'integer', example: 15 }
                  }
                },
                moduleUsage: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      membersWithAccess: { type: 'integer' },
                      percentage: { type: 'integer' }
                    }
                  }
                }
              }
            },
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user: {
                    $ref: '#/components/schemas/User'
                  },
                  role: {
                    type: 'string',
                    enum: ['USER', 'ORGANIZATION_ADMIN']
                  },
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string' },
                        resource: { type: 'string' }
                      }
                    }
                  },
                  permissionsByModule: {
                    type: 'object',
                    additionalProperties: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          action: { type: 'string' },
                          resource: { type: 'string' }
                        }
                      }
                    }
                  },
                  hasCustomPermissions: {
                    type: 'boolean'
                  }
                }
              }
            }
          }
        },
        Lead: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'lead123', description: 'Unique lead identifier' },
            organizationId: { type: 'string', example: 'org123', description: 'Organization ID' },
            assignedToId: { type: 'string', example: 'user123', description: 'Assigned agent user ID' },
            createdById: { type: 'string', example: 'user456', description: 'Creator user ID' },
            reassignedToId: { type: 'string', example: 'user789', description: 'Reassigned team lead user ID' },
            reassignedById: { type: 'string', example: 'user321', description: 'Reassigned by user ID' },
            reassignedAt: { type: 'string', format: 'date-time', example: '2024-01-20T15:30:00.000Z' },
            status: { type: 'string', enum: ['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','READY_FOR_PROCESSING','REASSIGNED','PROCESSING','COMPLETED','CLOSED_WON','CLOSED_LOST','ON_HOLD','CALL_LATER'], example: 'NEW' },
            source: { type: 'string', example: 'Web Form' },
            priority: { type: 'string', enum: ['LOW','MEDIUM','HIGH'], example: 'MEDIUM' },
            firstName: { type: 'string', example: 'Jane' },
            lastName: { type: 'string', example: 'Doe' },
            email: { type: 'string', example: 'jane.doe@example.com' },
            phone: { type: 'string', example: '+1234567890' },
            alternatePhone: { type: 'string', example: '+0987654321' },
            dateOfBirth: { type: 'string', format: 'date', example: '1990-01-01' },
            serviceAddress: { type: 'string', example: '123 Main St' },
            previousAddress: { type: 'string', example: '456 Old St' },
            shippingAddress: { type: 'string', example: '789 Ship St' },
            billingAddress: { type: 'string', example: '101 Bill St' },
            providerSold: { type: 'string', example: 'ProviderX' },
            packageDetails: { type: 'object', example: { plan: 'Gold', price: 99.99 } },
            internetSpeed: { type: 'string', example: '100Mbps' },
            dataCap: { type: 'string', example: '1TB' },
            tvPackage: { type: 'string', example: 'Premium' },
            tvBoxes: { type: 'integer', example: 2 },
            priceBeforeTax: { type: 'number', format: 'decimal', example: 99.99 },
            ssnLastFour: { type: 'string', example: '1234' },
            stateId: { type: 'string', example: 'CA' },
            dlNumberMasked: { type: 'string', example: 'XXX-1234' },
            dlExpiration: { type: 'string', format: 'date', example: '2025-12-31' },
            dlState: { type: 'string', example: 'CA' },
            securityPinHash: { type: 'string', example: 'hashed-pin' },
            securityQuestion: { type: 'string', example: 'Mother\'s maiden name?' },
            autopayAgreed: { type: 'boolean', example: true },
            installationDate: { type: 'string', format: 'date', example: '2024-02-01' },
            notes: { type: 'string', example: 'Customer prefers morning installation.' },
            callLaterDate: { type: 'string', format: 'date-time', example: '2024-02-10T10:00:00.000Z' },
            callLaterReason: { type: 'string', example: 'Requested call back after 5pm.' },
            customerCallbackRequested: { type: 'boolean', example: false },
            callbackTimePreference: { type: 'string', example: 'Evening' },
            repeatCustomer: { type: 'boolean', example: false },
            previousLeadId: { type: 'string', example: 'leadPrev123' },
            orderId: { type: 'string', example: 'order123' },
            orderStatus: { type: 'string', enum: ['PENDING','PROCESSING','COMPLETED','FAILED'], example: 'PENDING' },
            processedById: { type: 'string', example: 'user999' },
            processedAt: { type: 'string', format: 'date-time', example: '2024-02-15T12:00:00.000Z' },
            orderNotes: { type: 'string', example: 'Order processed successfully.' },
            reassignmentNotes: { type: 'string', example: 'Reassigned due to workload.' },
            agentInstructions: { type: 'string', example: 'Contact customer before 10am.' },
            lastContacted: { type: 'string', format: 'date-time', example: '2024-02-05T09:00:00.000Z' },
            nextFollowUp: { type: 'string', format: 'date-time', example: '2024-02-12T09:00:00.000Z' },
            estimatedValue: { type: 'number', format: 'decimal', example: 150.00 },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-20T15:30:00.000Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2024-01-21T10:00:00.000Z' }
          }
        },
        UserTeam: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'team123', description: 'Unique user team identifier' },
            organizationId: { type: 'string', example: 'org123', description: 'Organization ID' },
            managerId: { type: 'string', example: 'user123', description: 'Manager user ID' },
            memberId: { type: 'string', example: 'user456', description: 'Member user ID' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-20T15:30:00.000Z' }
          }
        }
      }
    },
    paths: {
      '/api/leads': {
        post: {
          summary: 'Create a new lead',
          tags: ['Leads'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } },
          responses: { 201: { description: 'Lead created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } } }
        },
        get: {
          summary: 'Get all leads',
          tags: ['Leads'],
          responses: { 200: { description: 'List of leads', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Lead' } } } } } }
        }
      },
      '/api/leads/{id}': {
        get: {
          summary: 'Get lead by ID',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Lead found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } }, 404: { description: 'Lead not found' } }
        },
        put: {
          summary: 'Update lead by ID',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } },
          responses: { 200: { description: 'Lead updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } }, 404: { description: 'Lead not found' } }
        },
        delete: {
          summary: 'Delete lead by ID',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Lead deleted' }, 404: { description: 'Lead not found' } }
        }
      },
      '/api/leads/{id}/approve': {
        patch: {
          summary: 'Approve a lead (Assigned Team Lead only)',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Lead approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } }, 403: { description: 'Only the assigned team lead can approve this lead.' }, 404: { description: 'Lead not found' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/leads/{id}/cancel': {
        patch: {
          summary: 'Cancel a lead (Team Lead only)',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Lead cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } }, 403: { description: 'Only Team Lead can cancel a lead.' }, 404: { description: 'Lead not found' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/api/leads/{id}/request-revision': {
        patch: {
          summary: 'Request revision for a lead (Team Lead only)',
          tags: ['Leads'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { revisionNotes: { type: 'string', example: 'Please update the address.' } } } } } },
          responses: { 200: { description: 'Revision requested', content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } }, 403: { description: 'Only Team Lead can request revision for a lead.' }, 404: { description: 'Lead not found' } },
          security: [{ bearerAuth: [] }]
        }
      },
      '/user-teams': {
        post: {
          summary: 'Create a new user team',
          tags: ['UserTeams'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserTeam' } } } },
          responses: { 201: { description: 'User team created', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserTeam' } } } } }
        },
        get: {
          summary: 'Get all user teams',
          tags: ['UserTeams'],
          responses: { 200: { description: 'List of user teams', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/UserTeam' } } } } } }
        }
      },
      '/user-teams/{id}': {
        get: {
          summary: 'Get user team by ID',
          tags: ['UserTeams'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'User team found', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserTeam' } } } }, 404: { description: 'User team not found' } }
        },
        put: {
          summary: 'Update user team by ID',
          tags: ['UserTeams'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserTeam' } } } },
          responses: { 200: { description: 'User team updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserTeam' } } } }, 404: { description: 'User team not found' } }
        },
        delete: {
          summary: 'Delete user team by ID',
          tags: ['UserTeams'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'User team deleted' }, 404: { description: 'User team not found' } }
        }
      },
      '/api/leads/user/{userId}': {
        get: {
          summary: 'Get all leads for a specific user',
          tags: ['Leads'],
          parameters: [
            { name: 'userId', in: 'path', required: true, schema: { type: 'string' }, description: 'User ID' }
          ],
          responses: {
            200: {
              description: 'List of leads for the user',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Lead' } } } }
            }
          },
          security: [{ bearerAuth: [] }]
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Path to the API files
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};
