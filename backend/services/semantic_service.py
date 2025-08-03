import re
from typing import List, Dict, Any
from models import Task, Memory

class SemanticService:
    """Service for semantic analysis and hierarchical organization of tasks and memories"""
    
    def __init__(self):
        # Define semantic categories with keywords
        self.semantic_categories = {
            'Authentication & Security': {
                'keywords': ['auth', 'login', 'password', 'security', 'jwt', 'oauth', 'encrypt', 'authentication', 'authorization', 'session', 'token'],
                'icon': '🔐'
            },
            'Database & Storage': {
                'keywords': ['database', 'db', 'sql', 'schema', 'migration', 'storage', 'query', 'table', 'index', 'backup', 'data'],
                'icon': '🗄️'
            },
            'API & Backend': {
                'keywords': ['api', 'backend', 'server', 'endpoint', 'rest', 'graphql', 'middleware', 'controller', 'service', 'route'],
                'icon': '⚙️'
            },
            'Frontend & UI': {
                'keywords': ['frontend', 'ui', 'react', 'component', 'css', 'styling', 'responsive', 'interface', 'design', 'layout'],
                'icon': '🎨'
            },
            'Testing & Quality': {
                'keywords': ['test', 'testing', 'unit', 'integration', 'quality', 'bug', 'fix', 'debug', 'qa', 'validation'],
                'icon': '🧪'
            },
            'Deployment & DevOps': {
                'keywords': ['deploy', 'docker', 'ci', 'cd', 'aws', 'server', 'production', 'environment', 'infrastructure', 'cloud'],
                'icon': '🚀'
            },
            'User Experience': {
                'keywords': ['ux', 'user', 'interface', 'experience', 'flow', 'design', 'usability', 'accessibility', 'wireframe'],
                'icon': '👥'
            },
            'Performance & Optimization': {
                'keywords': ['performance', 'optimize', 'speed', 'cache', 'memory', 'efficiency', 'load', 'response', 'latency'],
                'icon': '⚡'
            },
            'Project Management': {
                'keywords': ['plan', 'sprint', 'milestone', 'deadline', 'priority', 'status', 'tracking', 'progress', 'timeline'],
                'icon': '📋'
            },
            'Documentation': {
                'keywords': ['doc', 'documentation', 'readme', 'guide', 'manual', 'spec', 'comment', 'explain'],
                'icon': '📚'
            },
            'Error Handling': {
                'keywords': ['error', 'exception', 'handle', 'catch', 'try', 'validation', 'check', 'verify'],
                'icon': '⚠️'
            },
            'Configuration': {
                'keywords': ['config', 'setting', 'environment', 'variable', 'option', 'parameter', 'setup'],
                'icon': '⚙️'
            }
        }
    
    def create_semantic_hierarchy(self, tasks: List[Task], memories: List[Memory]) -> Dict[str, Any]:
        """
        Create semantic hierarchy using content analysis and keyword matching
        """
        all_items = []
        
        # Convert tasks to unified format
        for task in tasks:
            all_items.append({
                'id': task.id,
                'type': 'task',
                'title': task.title,
                'content': f"{task.title} {task.description}",
                'created_at': task.created_at,
                'status': task.status,
                'priority': task.priority,
                'item': task
            })
        
        # Convert memories to unified format
        for memory in memories:
            all_items.append({
                'id': memory.id,
                'type': 'memory',
                'title': memory.content[:50] + '...' if len(memory.content) > 50 else memory.content,
                'content': memory.content,
                'created_at': memory.created_at,
                'memory_type': memory.type,
                'item': memory
            })
        
        # Group items by semantic categories
        semantic_groups = self._group_by_semantic_categories(all_items)
        
        # Create hierarchical structure
        hierarchy = {
            'groups': semantic_groups,
            'total_items': len(all_items),
            'total_tasks': len(tasks),
            'total_memories': len(memories)
        }
        
        return hierarchy
    
    def _group_by_semantic_categories(self, items: List[Dict]) -> List[Dict]:
        """Group items by semantic categories using keyword matching"""
        groups = {}
        
        # Initialize groups
        for category_name, category_info in self.semantic_categories.items():
            groups[category_name] = {
                'name': category_name,
                'icon': category_info['icon'],
                'items': [],
                'keywords': category_info['keywords']
            }
        
        # Add general category for unclassified items
        groups['General'] = {
            'name': 'General',
            'icon': '📁',
            'items': [],
            'keywords': []
        }
        
        # Classify each item
        for item in items:
            content = item['content'].lower()
            assigned = False
            
            # Try to match with semantic categories
            for category_name, category_info in self.semantic_categories.items():
                if any(keyword in content for keyword in category_info['keywords']):
                    groups[category_name]['items'].append(item)
                    assigned = True
                    break
            
            # If no match found, assign to general
            if not assigned:
                groups['General']['items'].append(item)
        
        # Convert to list and sort by item count
        result = []
        for category_name, group in groups.items():
            if group['items']:  # Only include groups with items
                # Sort items by creation date (newest first)
                group['items'].sort(key=lambda x: x['created_at'], reverse=True)
                result.append(group)
        
        # Sort groups by item count (largest first)
        result.sort(key=lambda x: len(x['items']), reverse=True)
        
        return result
    
    def create_advanced_hierarchy(self, tasks: List[Task], memories: List[Memory], 
                                 clustering_type: str = 'content', depth: int = 2) -> Dict[str, Any]:
        """
        Create advanced hierarchical structure with multiple clustering options
        """
        if clustering_type == 'content':
            return self._cluster_by_content_similarity(tasks, memories, depth)
        elif clustering_type == 'dependencies':
            return self._cluster_by_dependencies(tasks, memories, depth)
        elif clustering_type == 'workflow':
            return self._cluster_by_workflow_stage(tasks, memories, depth)
        elif clustering_type == 'domain':
            return self._cluster_by_domain_knowledge(tasks, memories, depth)
        else:
            return self.create_semantic_hierarchy(tasks, memories)
    
    def _cluster_by_content_similarity(self, tasks: List[Task], memories: List[Memory], depth: int) -> Dict[str, Any]:
        """Cluster items by content similarity using more sophisticated analysis"""
        # This is a simplified version - in production, you'd use embeddings
        all_items = []
        
        for task in tasks:
            all_items.append({
                'id': task.id,
                'type': 'task',
                'content': f"{task.title} {task.description}",
                'created_at': task.created_at,
                'item': task
            })
        
        for memory in memories:
            all_items.append({
                'id': memory.id,
                'type': 'memory',
                'content': memory.content,
                'created_at': memory.created_at,
                'item': memory
            })
        
        # Simple content similarity using common words
        content_groups = self._group_by_common_words(all_items)
        
        return {
            'type': 'content_similarity',
            'depth': depth,
            'groups': content_groups,
            'total_items': len(all_items)
        }
    
    def _group_by_common_words(self, items: List[Dict]) -> List[Dict]:
        """Group items by common words in their content"""
        # Extract common technical terms
        technical_terms = {
            'user': ['user', 'login', 'register', 'profile', 'account'],
            'data': ['data', 'database', 'storage', 'save', 'load'],
            'api': ['api', 'endpoint', 'request', 'response', 'http'],
            'ui': ['ui', 'interface', 'component', 'button', 'form'],
            'test': ['test', 'testing', 'unit', 'integration', 'debug'],
            'deploy': ['deploy', 'production', 'server', 'host', 'release']
        }
        
        groups = {}
        
        for term, keywords in technical_terms.items():
            groups[term] = {
                'name': f'{term.title()} Related',
                'icon': '🔗',
                'items': []
            }
        
        groups['other'] = {
            'name': 'Other',
            'icon': '📁',
            'items': []
        }
        
        for item in items:
            content = item['content'].lower()
            assigned = False
            
            for term, keywords in technical_terms.items():
                if any(keyword in content for keyword in keywords):
                    groups[term]['items'].append(item)
                    assigned = True
                    break
            
            if not assigned:
                groups['other']['items'].append(item)
        
        result = []
        for group in groups.values():
            if group['items']:
                group['items'].sort(key=lambda x: x['created_at'], reverse=True)
                result.append(group)
        
        return result
    
    def _cluster_by_dependencies(self, tasks: List[Task], memories: List[Memory], depth: int) -> Dict[str, Any]:
        """Cluster items by task dependencies and relationships"""
        # This would analyze task dependencies and create dependency chains
        # For now, return a simple structure
        return {
            'type': 'dependencies',
            'depth': depth,
            'groups': [
                {
                    'name': 'Core Dependencies',
                    'icon': '🔗',
                    'items': []
                },
                {
                    'name': 'Optional Dependencies',
                    'icon': '🔗',
                    'items': []
                }
            ],
            'total_items': len(tasks) + len(memories)
        }
    
    def _cluster_by_workflow_stage(self, tasks: List[Task], memories: List[Memory], depth: int) -> Dict[str, Any]:
        """Cluster items by workflow stage (planning, development, testing, deployment)"""
        workflow_stages = {
            'planning': {
                'name': 'Planning & Design',
                'icon': '📋',
                'keywords': ['plan', 'design', 'spec', 'requirement', 'architecture'],
                'items': []
            },
            'development': {
                'name': 'Development',
                'icon': '💻',
                'keywords': ['implement', 'code', 'develop', 'build', 'create'],
                'items': []
            },
            'testing': {
                'name': 'Testing & QA',
                'icon': '🧪',
                'keywords': ['test', 'debug', 'qa', 'validate', 'verify'],
                'items': []
            },
            'deployment': {
                'name': 'Deployment & Release',
                'icon': '🚀',
                'keywords': ['deploy', 'release', 'production', 'publish', 'launch'],
                'items': []
            }
        }
        
        all_items = []
        for task in tasks:
            all_items.append({
                'id': task.id,
                'type': 'task',
                'content': f"{task.title} {task.description}",
                'created_at': task.created_at,
                'item': task
            })
        
        for memory in memories:
            all_items.append({
                'id': memory.id,
                'type': 'memory',
                'content': memory.content,
                'created_at': memory.created_at,
                'item': memory
            })
        
        # Classify items by workflow stage
        for item in all_items:
            content = item['content'].lower()
            assigned = False
            
            for stage, stage_info in workflow_stages.items():
                if any(keyword in content for keyword in stage_info['keywords']):
                    stage_info['items'].append(item)
                    assigned = True
                    break
            
            if not assigned:
                # Default to development if no clear match
                workflow_stages['development']['items'].append(item)
        
        result = []
        for stage_info in workflow_stages.values():
            if stage_info['items']:
                stage_info['items'].sort(key=lambda x: x['created_at'], reverse=True)
                result.append(stage_info)
        
        return {
            'type': 'workflow_stage',
            'depth': depth,
            'groups': result,
            'total_items': len(all_items)
        }
    
    def _cluster_by_domain_knowledge(self, tasks: List[Task], memories: List[Memory], depth: int) -> Dict[str, Any]:
        """Cluster items by domain knowledge areas"""
        # This would use more sophisticated domain analysis
        # For now, return the basic semantic hierarchy
        return self.create_semantic_hierarchy(tasks, memories) 