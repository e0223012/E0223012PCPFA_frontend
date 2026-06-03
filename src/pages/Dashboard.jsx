import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../hooks/useAuth.js';
import { ACTIONS } from '../reducer/appReducer.js';
import {
  authAPI,
  syncAPI,
  usersAPI,
  projectsAPI,
  issuesAPI,
  commentsAPI,
  analyticsAPI
} from '../services/api.js';

const Dashboard = ({ tab = 'dashboard' }) => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();

  // Component states
  const [syncStatus, setSyncStatus] = useState(null);
  const [showSyncForm, setShowSyncForm] = useState(false);
  const [syncCreds, setSyncCreds] = useState({
    studentId: 'E0223012',
    password: '485497',
    set: 'setB'
  });

  // Projects states
  const [newProj, setNewProj] = useState({ projectId: '', title: '', description: '', owner: '', status: 'active' });
  const [projFilter, setProjFilter] = useState({ status: '', owner: '' });
  const [projSearch, setProjSearch] = useState('');

  // Issues states
  const [newIssue, setNewIssue] = useState({
    issueId: '', projectId: '', assignedTo: '', reportedBy: '',
    title: '', description: '', priority: 'medium', severity: 'major', status: 'open', dueDate: ''
  });
  const [issueFilter, setIssueFilter] = useState({ priority: '', status: '', severity: '', search: '', page: 1, limit: 10 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });

  // Status & Assignment updates
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [editStatusVal, setEditStatusVal] = useState('');
  const [editAssigneeVal, setEditAssigneeVal] = useState('');

  // Comments states
  const [activeIssueComments, setActiveIssueComments] = useState('');
  const [newCommentMsg, setNewCommentMsg] = useState('');

  // Local notification messages
  const [message, setMessage] = useState({ type: '', text: '' });

  // Redirect to login if token is missing
  useEffect(() => {
    if (!state.jwtToken) {
      navigate('/login');
    }
  }, [state.jwtToken, navigate]);

  // Fetch initial data based on active tab
  useEffect(() => {
    if (state.jwtToken && state.authenticatedUser) {
      fetchTabSpecificData();
    }
  }, [tab, state.jwtToken, state.authenticatedUser, issueFilter.priority, issueFilter.status, issueFilter.severity, issueFilter.page, projFilter.status]);

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const fetchTabSpecificData = async () => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      if (tab === 'dashboard') {
        const issuesRes = await analyticsAPI.getIssues();
        const projsRes = await analyticsAPI.getProjects();
        if (issuesRes.data.success) {
          dispatch({ type: ACTIONS.SET_ANALYTICS_ISSUES, payload: issuesRes.data.data });
        }
        if (projsRes.data.success) {
          dispatch({ type: ACTIONS.SET_ANALYTICS_PROJECTS, payload: projsRes.data.data });
        }

        // Also fetch developers analytics for admin/manager
        if (['admin', 'manager'].includes(state.authenticatedUser.role)) {
          const devsRes = await analyticsAPI.getDevelopers();
          if (devsRes.data.success) {
            dispatch({ type: ACTIONS.SET_ANALYTICS_DEVELOPERS, payload: devsRes.data.data });
          }
        }
      } else if (tab === 'users') {
        const res = await usersAPI.getAll();
        if (res.data.success) {
          dispatch({ type: ACTIONS.SET_USERS, payload: res.data.data });
        }
      } else if (tab === 'projects') {
        const res = await projectsAPI.getAll(projFilter);
        if (res.data.success) {
          dispatch({ type: ACTIONS.SET_PROJECTS, payload: res.data.data });
        }
        // Also load users to choose members/owners
        const usersRes = await usersAPI.getAll();
        if (usersRes.data.success) {
          dispatch({ type: ACTIONS.SET_USERS, payload: usersRes.data.data });
        }
      } else if (tab === 'issues') {
        const res = await issuesAPI.getAll(issueFilter);
        if (res.data.success) {
          dispatch({ type: ACTIONS.SET_ISSUES, payload: res.data.data });
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
        // Load projects & users for issue forms
        const projsRes = await projectsAPI.getAll();
        const usersRes = await usersAPI.getAll();
        if (projsRes.data.success) {
          dispatch({ type: ACTIONS.SET_PROJECTS, payload: projsRes.data.data });
        }
        if (usersRes.data.success) {
          dispatch({ type: ACTIONS.SET_USERS, payload: usersRes.data.data });
        }
      } else if (tab === 'comments') {
        // Load issues to post comments on
        const issuesRes = await issuesAPI.getAll({ limit: 100 });
        if (issuesRes.data.success) {
          dispatch({ type: ACTIONS.SET_ISSUES, payload: issuesRes.data.data });
        }
        if (activeIssueComments) {
          const commRes = await commentsAPI.getAll(activeIssueComments);
          if (commRes.data.success) {
            dispatch({ type: ACTIONS.SET_COMMENTS, payload: commRes.data.data });
          }
        }
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.response?.data?.message || 'Failed to fetch data' });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const handleLogout = () => {
    dispatch({ type: ACTIONS.LOGOUT });
    navigate('/login');
  };

  // Sync dataset handler
  const handleSync = async (e) => {
    if (e) e.preventDefault();
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    setSyncStatus(null);
    try {
      const res = await syncAPI.sync(syncCreds);
      if (res.data.success) {
        setSyncStatus(res.data.data || res.data);
        showNotification('success', 'Synchronization completed successfully!');
        setShowSyncForm(false);
        // Refresh dashboard counters
        fetchTabSpecificData();
      } else {
        showNotification('error', res.data.message || 'Sync failed.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      showNotification('error', error.response?.data?.message || 'Dataset synchronization failed.');
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Project submission handler
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await projectsAPI.create(newProj);
      if (res.data.success) {
        dispatch({ type: ACTIONS.ADD_PROJECT, payload: res.data.data });
        showNotification('success', 'Project created successfully!');
        setNewProj({ projectId: '', title: '', description: '', owner: '', status: 'active' });
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to create project.');
    }
  };

  // Project deletion
  const handleDeleteProject = async (projId) => {
    if (!window.confirm(`Are you sure you want to delete project ${projId}?`)) return;
    try {
      const res = await projectsAPI.delete(projId);
      if (res.data.success) {
        dispatch({ type: ACTIONS.DELETE_PROJECT, payload: projId });
        showNotification('success', 'Project deleted successfully.');
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to delete project.');
    }
  };

  // Issue creation
  const handleCreateIssue = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newIssue, reportedBy: state.authenticatedUser.userId };
      const res = await issuesAPI.create(payload);
      if (res.data.success) {
        dispatch({ type: ACTIONS.ADD_ISSUE, payload: res.data.data });
        showNotification('success', 'Issue reported successfully!');
        setNewIssue({
          issueId: '', projectId: '', assignedTo: '', reportedBy: '',
          title: '', description: '', priority: 'medium', severity: 'major', status: 'open', dueDate: ''
        });
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to create issue.');
    }
  };

  // Issue deletion
  const handleDeleteIssue = async (issueId) => {
    if (!window.confirm(`Are you sure you want to delete issue ${issueId}?`)) return;
    try {
      const res = await issuesAPI.delete(issueId);
      if (res.data.success) {
        dispatch({ type: ACTIONS.DELETE_ISSUE, payload: issueId });
        showNotification('success', 'Issue deleted successfully.');
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to delete issue.');
    }
  };

  // Workflow: Update status
  const handleUpdateStatus = async (issueId, newStatus) => {
    try {
      const res = await issuesAPI.updateStatus(issueId, newStatus);
      if (res.data.success) {
        dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: res.data.data });
        showNotification('success', 'Issue status updated successfully.');
        setEditingIssueId(null);
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to update issue status.');
    }
  };

  // Workflow: Assign issue
  const handleAssignIssue = async (issueId, assignedTo) => {
    try {
      const res = await issuesAPI.assign(issueId, assignedTo);
      if (res.data.success) {
        dispatch({ type: ACTIONS.UPDATE_ISSUE, payload: res.data.data });
        showNotification('success', 'Issue assigned successfully.');
        setEditingIssueId(null);
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to assign issue.');
    }
  };

  // Comments: Load comments for an issue
  const selectCommentsIssue = async (issueId) => {
    setActiveIssueComments(issueId);
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      const res = await commentsAPI.getAll(issueId);
      if (res.data.success) {
        dispatch({ type: ACTIONS.SET_COMMENTS, payload: res.data.data });
      }
    } catch (error) {
      showNotification('error', 'Failed to load comments.');
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  // Comments: Add comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!activeIssueComments || !newCommentMsg) return;
    try {
      const res = await commentsAPI.create({ issueId: activeIssueComments, message: newCommentMsg });
      if (res.data.success) {
        dispatch({ type: ACTIONS.ADD_COMMENT, payload: res.data.data });
        setNewCommentMsg('');
        showNotification('success', 'Comment added.');
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to add comment.');
    }
  };

  // Comments: Delete comment
  const handleDeleteComment = async (commentId) => {
    try {
      const res = await commentsAPI.delete(commentId);
      if (res.data.success) {
        dispatch({ type: ACTIONS.DELETE_COMMENT, payload: commentId });
        showNotification('success', 'Comment deleted.');
      }
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Failed to delete comment.');
    }
  };

  return (
    <div >
      {/* Header & Navigation */}
      <nav data-testid="navbar" >
        <div >
          <h2 >PCP BugTracker</h2>
          <div >
            <span
              data-testid="dashboard-link"
              onClick={() => navigate('/dashboard')}
              
            >
              Dashboard
            </span>
            <span
              data-testid="users-link"
              onClick={() => navigate('/users')}
              
            >
              Users
            </span>
            <span
              data-testid="projects-link"
              onClick={() => navigate('/projects')}
              
            >
              Projects
            </span>
            <span
              data-testid="issues-link"
              onClick={() => navigate('/issues')}
              
            >
              Issues
            </span>
            <span
              data-testid="comments-link"
              onClick={() => navigate('/comments')}
              
            >
              Comments
            </span>
            <span
              data-testid="profile-link"
              onClick={() => navigate('/profile')}
              
            >
              Profile
            </span>
          </div>
        </div>
        <div >
          {state.authenticatedUser && (
            <span >
              Logged in as: <strong >{state.authenticatedUser.name}</strong> ({state.authenticatedUser.role})
            </span>
          )}
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div >
        {/* Local Notifications */}
        {message.text && (
          <div >
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} >x</button>
          </div>
        )}

        {state.loading && <div >Processing, please wait...</div>}

        {/* TAB: DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <div >
              <h3 >System Analytics Dashboard</h3>
              <div>
                <button
                  data-testid="sync-btn"
                  onClick={() => setShowSyncForm(!showSyncForm)}
                  
                >
                  Sync API Dataset
                </button>
              </div>
            </div>

            {/* Sync configuration overlay form */}
            {showSyncForm && (
              <div >
                <h4 >Sync Credentials</h4>
                <form onSubmit={handleSync}>
                  <div >
                    <label >Student ID</label>
                    <input
                      type="text"
                      value={syncCreds.studentId}
                      onChange={e => setSyncCreds({ ...syncCreds, studentId: e.target.value })}
                      
                    />
                  </div>
                  <div >
                    <label >Password</label>
                    <input
                      type="text"
                      value={syncCreds.password}
                      onChange={e => setSyncCreds({ ...syncCreds, password: e.target.value })}
                      
                    />
                  </div>
                  <div >
                    <label >Set Variant</label>
                    <input
                      type="text"
                      value={syncCreds.set}
                      onChange={e => setSyncCreds({ ...syncCreds, set: e.target.value })}
                      
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="submit-sync-btn"
                    
                  >
                    Submit & Synchronize
                  </button>
                </form>
              </div>
            )}

            {/* Sync results display */}
            {syncStatus && (
              <div >
                <h4 >Synchronization Summary Result:</h4>
                <ul >
                  <li>Total Fetched: {syncStatus.totalFetched}</li>
                  <li>Inserted to DB: {syncStatus.inserted}</li>
                  <li>Duplicates Skipped: {syncStatus.duplicates}</li>
                  <li>Rejected Entries: {syncStatus.rejected}</li>
                </ul>
              </div>
            )}

            {/* Analytics Container */}
            <div data-testid="analytics-container" >
              <div data-testid="total-issues-card" >
                <span >TOTAL ISSUES</span>
                <h2 >{state.analytics.issues?.total || 0}</h2>
              </div>
              <div data-testid="active-projects-card" >
                <span >ACTIVE PROJECTS</span>
                <h2 >{state.analytics.projects?.activeCount || 0}</h2>
              </div>
              <div data-testid="open-issues-card" >
                <span >OPEN ISSUES</span>
                <h2 >{state.analytics.issues?.open || 0}</h2>
              </div>
              <div data-testid="closed-issues-card" >
                <span >CLOSED ISSUES</span>
                <h2 >{state.analytics.issues?.closed || 0}</h2>
              </div>
            </div>

            {/* Analytics Details & Charts */}
            <div >
              {/* Chart/Representation Card */}
              <div data-testid="issue-chart" >
                <h4 >Issue Distribution Status</h4>
                {state.analytics.issues ? (
                  <div >
                    <div>
                      <div >
                        <span>Open ({state.analytics.issues.open})</span>
                        <span>{Math.round((state.analytics.issues.open / (state.analytics.issues.total || 1)) * 100)}%</span>
                      </div>
                      <div >
                        <div ></div>
                      </div>
                    </div>
                    <div>
                      <div >
                        <span>In Progress ({state.analytics.issues.inProgress || 0})</span>
                        <span>{Math.round(((state.analytics.issues.inProgress || 0) / (state.analytics.issues.total || 1)) * 100)}%</span>
                      </div>
                      <div >
                        <div ></div>
                      </div>
                    </div>
                    <div>
                      <div >
                        <span>Testing ({state.analytics.issues.testing || 0})</span>
                        <span>{Math.round(((state.analytics.issues.testing || 0) / (state.analytics.issues.total || 1)) * 100)}%</span>
                      </div>
                      <div >
                        <div ></div>
                      </div>
                    </div>
                    <div>
                      <div >
                        <span>Resolved ({state.analytics.issues.resolved || 0})</span>
                        <span>{Math.round(((state.analytics.issues.resolved || 0) / (state.analytics.issues.total || 1)) * 100)}%</span>
                      </div>
                      <div >
                        <div ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span >Sync data to view chart analytics.</span>
                )}
              </div>

              {/* Recent Activity Card */}
              <div data-testid="recent-activity" >
                <h4 >Project Workloads (Issues count)</h4>
                <div >
                  {state.analytics.projects?.projectWiseCount && state.analytics.projects.projectWiseCount.length > 0 ? (
                    <table >
                      <thead>
                        <tr >
                          <th >Project ID</th>
                          <th >Project Title</th>
                          <th >Issues Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.analytics.projects.projectWiseCount.slice(0, 5).map(p => (
                          <tr key={p.projectId} >
                            <td >{p.projectId}</td>
                            <td >{p.title}</td>
                            <td >{p.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <span >Sync dataset to load project analytics details.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Developer Performance Analytics (Admins & Managers Only) */}
            {['admin', 'manager'].includes(state.authenticatedUser?.role) && state.analytics.developers && (
              <div >
                <h4 >Developer Resolution Performance</h4>
                <div >
                  <table >
                    <thead>
                      <tr >
                        <th >Developer Name</th>
                        <th >Developer ID</th>
                        <th >Department</th>
                        <th >Resolved Issues</th>
                        <th >Avg Resolution Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.analytics.developers.developers.map(dev => (
                        <tr key={dev.developerId} >
                          <td >{dev.name}</td>
                          <td >{dev.developerId}</td>
                          <td >{dev.department}</td>
                          <td >{dev.resolvedCount}</td>
                          <td >
                            {dev.avgResolutionTimeHours > 0 ? `${dev.avgResolutionTimeHours} hrs` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: USERS */}
        {tab === 'users' && (
          <div >
            <h3 >User Directory</h3>
            <div >
              <table >
                <thead>
                  <tr >
                    <th >User ID</th>
                    <th >Name</th>
                    <th >Email</th>
                    <th >Role</th>
                    <th >Department</th>
                    <th >Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map(u => (
                    <tr key={u.userId} >
                      <td >{u.userId}</td>
                      <td >{u.name}</td>
                      <td >{u.email}</td>
                      <td >
                        <span >
                          {u.role}
                        </span>
                      </td>
                      <td >{u.department}</td>
                      <td >{u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PROJECTS */}
        {tab === 'projects' && (
          <div >
            {/* Create Project Form (Admins & Managers Only) */}
            {['admin', 'manager'].includes(state.authenticatedUser?.role) && (
              <div >
                <h3 >Create New Project</h3>
                <form onSubmit={handleCreateProject} >
                  <div>
                    <label >Project ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PROJ1001"
                      value={newProj.projectId}
                      onChange={e => setNewProj({ ...newProj, projectId: e.target.value })}
                      
                    />
                  </div>
                  <div>
                    <label >Project Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Core CRM"
                      value={newProj.title}
                      onChange={e => setNewProj({ ...newProj, title: e.target.value })}
                      
                    />
                  </div>
                  <div>
                    <label >Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Database engine"
                      value={newProj.description}
                      onChange={e => setNewProj({ ...newProj, description: e.target.value })}
                      
                    />
                  </div>
                  <div>
                    <label >Owner ID</label>
                    <select
                      value={newProj.owner}
                      onChange={e => setNewProj({ ...newProj, owner: e.target.value })}
                      
                    >
                      <option value="">Select Owner</option>
                      {state.users.filter(u => ['admin', 'manager'].includes(u.role)).map(u => (
                        <option key={u.userId} value={u.userId}>{u.name} ({u.userId})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      data-testid="create-project-btn"
                      
                    >
                      Add Project
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Projects Directory & Filters */}
            <div >
              <div >
                <h3 >Projects Directory</h3>
                {/* Project filter */}
                <div >
                  <input
                    type="text"
                    placeholder="Search projects..."
                    data-testid="project-search"
                    value={projSearch}
                    onChange={e => setProjSearch(e.target.value)}
                    
                  />
                  <select
                    value={projFilter.status}
                    onChange={e => setProjFilter({ ...projFilter, status: e.target.value })}
                    
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div >
                <table data-testid="project-list" >
                  <thead>
                    <tr >
                      <th >Project ID</th>
                      <th >Title</th>
                      <th >Description</th>
                      <th >Owner</th>
                      <th >Members</th>
                      <th >Status</th>
                      {['admin', 'manager'].includes(state.authenticatedUser?.role) && <th >Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {state.projects
                      .filter(p =>
                        p.title.toLowerCase().includes(projSearch.toLowerCase()) ||
                        p.projectId.toLowerCase().includes(projSearch.toLowerCase()) ||
                        (p.description && p.description.toLowerCase().includes(projSearch.toLowerCase()))
                      )
                      .map(p => (
                        <tr key={p.projectId} >
                          <td >{p.projectId}</td>
                          <td >{p.title}</td>
                          <td >{p.description}</td>
                          <td >{p.owner || 'N/A'}</td>
                          <td >
                            {p.members && p.members.length > 0 ? p.members.join(', ') : 'No members'}
                          </td>
                          <td >
                            <span >
                              {p.status}
                            </span>
                          </td>
                          {['admin', 'manager'].includes(state.authenticatedUser?.role) && (
                            <td >
                              <button
                                onClick={() => handleDeleteProject(p.projectId)}
                                
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ISSUES */}
        {tab === 'issues' && (
          <div >
            {/* Create Issue Form (Tester, Admin, Manager only) */}
            {['admin', 'manager', 'tester'].includes(state.authenticatedUser?.role) && (
              <div >
                <h3 >Report New Issue</h3>
                <form onSubmit={handleCreateIssue} >
                  <div>
                    <label >Issue ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ISS1001"
                      value={newIssue.issueId}
                      onChange={e => setNewIssue({ ...newIssue, issueId: e.target.value })}
                      
                    />
                  </div>
                  <div>
                    <label >Project</label>
                    <select
                      required
                      value={newIssue.projectId}
                      onChange={e => setNewIssue({ ...newIssue, projectId: e.target.value })}
                      
                    >
                      <option value="">Select Project</option>
                      {state.projects.map(p => (
                        <option key={p.projectId} value={p.projectId}>{p.title} ({p.projectId})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label >Issue Title</label>
                    <input
                      type="text"
                      required
                      placeholder="Title of bug"
                      value={newIssue.title}
                      onChange={e => setNewIssue({ ...newIssue, title: e.target.value })}
                      
                    />
                  </div>
                  <div>
                    <label >Priority</label>
                    <select
                      value={newIssue.priority}
                      onChange={e => setNewIssue({ ...newIssue, priority: e.target.value })}
                      
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label >Severity</label>
                    <select
                      value={newIssue.severity}
                      onChange={e => setNewIssue({ ...newIssue, severity: e.target.value })}
                      
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  {['admin', 'manager'].includes(state.authenticatedUser?.role) && (
                    <div>
                      <label >Assign Developer</label>
                      <select
                        value={newIssue.assignedTo}
                        onChange={e => setNewIssue({ ...newIssue, assignedTo: e.target.value })}
                        
                      >
                        <option value="">Unassigned</option>
                        {state.users.filter(u => u.role === 'developer').map(u => (
                          <option key={u.userId} value={u.userId}>{u.name} ({u.userId})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div >
                    <label >Description</label>
                    <textarea
                      value={newIssue.description}
                      onChange={e => setNewIssue({ ...newIssue, description: e.target.value })}
                      
                    />
                  </div>
                  <div >
                    <button
                      type="submit"
                      data-testid="add-task-btn"
                      
                    >
                      Report Issue
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Issues Directory with Search & Filtering */}
            <div >
              <div >
                <h3 >Issues Directory</h3>
                {/* Filters Row */}
                <div >
                  {/* Search input */}
                  <div>
                    <input
                      type="text"
                      placeholder="Search title/desc..."
                      data-testid="issue-search"
                      value={issueFilter.search}
                      onChange={e => setIssueFilter({ ...issueFilter, search: e.target.value, page: 1 })}
                      
                    />
                    <button
                      onClick={fetchTabSpecificData}
                      
                    >
                      Search
                    </button>
                  </div>

                  {/* Priority filter */}
                  <div>
                    <select
                      data-testid="issue-filter"
                      value={issueFilter.priority}
                      onChange={e => setIssueFilter({ ...issueFilter, priority: e.target.value, page: 1 })}
                      
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  {/* Status filter */}
                  <div>
                    <select
                      data-testid="issue-filter"
                      value={issueFilter.status}
                      onChange={e => setIssueFilter({ ...issueFilter, status: e.target.value, page: 1 })}
                      
                    >
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="testing">Testing</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Severity filter */}
                  <div>
                    <select
                      data-testid="issue-filter"
                      value={issueFilter.severity}
                      onChange={e => setIssueFilter({ ...issueFilter, severity: e.target.value, page: 1 })}
                      
                    >
                      <option value="">All Severities</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Issues Table */}
              <div >
                <table data-testid="issue-table" >
                  <thead>
                    <tr >
                      <th >Issue ID</th>
                      <th >Project</th>
                      <th >Title</th>
                      <th >Priority</th>
                      <th >Severity</th>
                      <th >Assigned To</th>
                      <th >Status</th>
                      <th >Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.issues.map(i => {
                      const isAssignedDev = state.authenticatedUser?.role === 'developer' && i.assignedTo === state.authenticatedUser.userId;
                      const isManagerOrAdmin = ['admin', 'manager'].includes(state.authenticatedUser?.role);

                      return (
                        <tr key={i.issueId} data-testid="issue-row" >
                          <td >{i.issueId}</td>
                          <td >{i.projectId}</td>
                          <td >
                            <div >{i.title}</div>
                            <div >{i.description}</div>
                          </td>
                          <td >{i.priority}</td>
                          <td >{i.severity}</td>
                          <td >
                            {editingIssueId === i.issueId && isManagerOrAdmin ? (
                              <div >
                                <select
                                  value={editAssigneeVal}
                                  onChange={e => setEditAssigneeVal(e.target.value)}
                                  
                                >
                                  <option value="">Unassigned</option>
                                  {state.users.filter(u => u.role === 'developer').map(u => (
                                    <option key={u.userId} value={u.userId}>{u.name}</option>
                                  ))}
                                </select>
                                <button
                                  data-testid="assign-issue-btn"
                                  onClick={() => handleAssignIssue(i.issueId, editAssigneeVal)}
                                  
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <span >
                                {i.assignedTo || 'Unassigned'}
                                {isManagerOrAdmin && i.status !== 'closed' && (
                                  <span
                                    data-testid="assign-issue-btn"
                                    onClick={() => { setEditingIssueId(i.issueId); setEditAssigneeVal(i.assignedTo || ''); }}
                                    
                                  >
                                    [Edit]
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td >
                            {editingIssueId === i.issueId && (isAssignedDev || isManagerOrAdmin) ? (
                              <div >
                                <select
                                  value={editStatusVal}
                                  onChange={e => setEditStatusVal(e.target.value)}
                                  
                                >
                                  <option value="open">Open</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="testing">Testing</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="closed">Closed</option>
                                </select>
                                <button
                                  data-testid="save-task-btn"
                                  onClick={() => handleUpdateStatus(i.issueId, editStatusVal)}
                                  
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <span >
                                <span >
                                  {i.status}
                                </span>
                                {(isAssignedDev || isManagerOrAdmin) && (
                                  <span
                                    onClick={() => { setEditingIssueId(i.issueId); setEditStatusVal(i.status); }}
                                    
                                  >
                                    [Edit]
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td >
                            <div >
                              <button
                                onClick={() => {
                                  navigate('/comments');
                                  selectCommentsIssue(i.issueId);
                                }}
                                
                              >
                                Comments
                              </button>
                              {isManagerOrAdmin && (
                                <button
                                  onClick={() => handleDeleteIssue(i.issueId)}
                                  
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div >
                <button
                  data-testid="pagination-prev"
                  disabled={issueFilter.page <= 1}
                  onClick={() => setIssueFilter({ ...issueFilter, page: issueFilter.page - 1 })}
                  
                >
                  Prev
                </button>
                <span>Page {pagination.page} of {pagination.pages || 1}</span>
                <button
                  data-testid="pagination-next"
                  disabled={issueFilter.page >= pagination.pages}
                  onClick={() => setIssueFilter({ ...issueFilter, page: issueFilter.page + 1 })}
                  
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: COMMENTS */}
        {tab === 'comments' && (
          <div >
            {/* Sidebar of Issues */}
            <div >
              <h4 >Select Issue</h4>
              {state.issues.map(i => (
                <div
                  key={i.issueId}
                  onClick={() => selectCommentsIssue(i.issueId)}
                  
                >
                  <strong>{i.issueId}</strong> - {i.title}
                </div>
              ))}
            </div>

            {/* Comments List & Posting */}
            <div >
              {activeIssueComments ? (
                <div>
                  <h3 >Comments for {activeIssueComments}</h3>

                  {/* Post Comment Form (Admin, Manager, Tester, Developer - all logged in users can comment) */}
                  <form onSubmit={handleAddComment} >
                    <input
                      type="text"
                      required
                      placeholder="Add a comment message..."
                      value={newCommentMsg}
                      onChange={e => setNewCommentMsg(e.target.value)}
                      
                    />
                    <button
                      type="submit"
                      data-testid="add-comment-btn"
                      
                    >
                      Post Comment
                    </button>
                  </form>

                  {/* List of comments */}
                  <div >
                    {state.comments.length > 0 ? (
                      <table data-testid="comment-table" >
                        <thead>
                          <tr >
                            <th >User ID</th>
                            <th >Message</th>
                            <th >Timestamp</th>
                            <th >Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.comments.map(c => {
                            const isCommentOwner = state.authenticatedUser?.userId === c.userId;
                            const isManagerOrAdmin = ['admin', 'manager'].includes(state.authenticatedUser?.role);

                            return (
                              <tr key={c.commentId} data-testid="comment-row" >
                                <td >{c.userId}</td>
                                <td >{c.message}</td>
                                <td >{new Date(c.createdAt).toLocaleString()}</td>
                                <td >
                                  {(isCommentOwner || isManagerOrAdmin) && (
                                    <button
                                      onClick={() => handleDeleteComment(c.commentId)}
                                      
                                    >
                                      Delete
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <span >No comments posted on this issue yet.</span>
                    )}
                  </div>
                </div>
              ) : (
                <div >
                  <h4>Select an issue from the sidebar to view and add comments.</h4>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PROFILE */}
        {tab === 'profile' && (
          <div >
            <h3 >User Profile Details</h3>
            {state.authenticatedUser ? (
              <div >
                <div><strong>User ID:</strong> {state.authenticatedUser.userId}</div>
                <div><strong>Name:</strong> {state.authenticatedUser.name}</div>
                <div><strong>Email:</strong> {state.authenticatedUser.email}</div>
                <div><strong>Role:</strong> {state.authenticatedUser.role}</div>
                <div><strong>Department:</strong> {state.authenticatedUser.department}</div>
                <div><strong>Status:</strong> {state.authenticatedUser.status}</div>
              </div>
            ) : (
              <div>No user profile details available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
