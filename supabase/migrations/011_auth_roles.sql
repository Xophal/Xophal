-- Complete the role vocabulary used by the authentication and content workflows.
-- ON CONFLICT keeps this migration safe to apply to an existing project.
INSERT INTO roles (code, name, description, is_system) VALUES
  ('author', 'Author', 'Creates and maintains educational content', true),
  ('reviewer', 'Reviewer', 'Reviews and approves educational content', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

INSERT INTO permissions (code, name, module, description) VALUES
  ('content.review', 'Review Content', 'content', 'Approve or reject educational content'),
  ('content.publish', 'Publish Content', 'content', 'Publish approved educational content')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('content.read', 'content.write')
WHERE r.code = 'author'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('content.read', 'content.review')
WHERE r.code = 'reviewer'
ON CONFLICT DO NOTHING;