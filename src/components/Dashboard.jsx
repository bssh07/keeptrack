import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { LogOut, Plus, Trash2, CheckCircle, Circle, Target, Edit2, X, Check, Menu, ChevronDown, ChevronUp, ListTodo, Clock, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('all');

  // Forms
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Low');
  const [newTaskDate, setNewTaskDate] = useState('');

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editingGoalData, setEditingGoalData] = useState({ title: '', dueDate: '' });
  
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskData, setEditingTaskData] = useState({ title: '', priority: '', dueDate: '', description: '' });

  // UI state
  const [expandedTasks, setExpandedTasks] = useState([]);

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch Goals
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'goals'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const goalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGoals(goalsData);
      if (goalsData.length === 0 && selectedGoalId !== 'all' && selectedGoalId !== 'deleted') {
        setSelectedGoalId('all');
      }
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid, selectedGoalId]);

  // Fetch Tasks
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, 'tasks'), where('userId', '==', auth.currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const priorityWeight = { High: 3, Medium: 2, Low: 1 };
      
      // Sort in memory: incomplete first, completed at the bottom, then by priority, then by creation date
      tasksData.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        
        const priorityA = priorityWeight[a.priority] || 1;
        const priorityB = priorityWeight[b.priority] || 1;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }

        const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeA - timeB;
      });
      setTasks(tasksData);
    }, (error) => {
      console.error("Error listening to tasks:", error);
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'goals'), {
        userId: auth.currentUser.uid,
        title: newGoalTitle,
        dueDate: newGoalDate || '', // Optional
        createdAt: serverTimestamp()
      });
      setSelectedGoalId(docRef.id);
      setNewGoalTitle('');
      setNewGoalDate('');
    } catch (error) {
      console.error("Error adding goal", error);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (confirm("Are you sure you want to delete this goal and all its tasks?")) {
      await deleteDoc(doc(db, 'goals', id));
      if (selectedGoalId === id) setSelectedGoalId('all');
    }
  };

  const saveGoalEdit = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'goals', id), {
        title: editingGoalData.title,
        dueDate: editingGoalData.dueDate || ''
      });
      setEditingGoalId(null);
    } catch (error) {
      console.error("Error updating goal", error);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedGoalId || selectedGoalId === 'all' || selectedGoalId === 'deleted') return;
    try {
      await addDoc(collection(db, 'tasks'), {
        userId: auth.currentUser.uid,
        goalId: selectedGoalId,
        title: newTaskTitle,
        description: newTaskDescription || '',
        priority: newTaskPriority,
        dueDate: newTaskDate || '', // Optional
        completed: false,
        deleted: false,
        createdAt: serverTimestamp()
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('Low');
      setNewTaskDate('');
    } catch (error) {
      console.error("Error adding task", error);
    }
  };

  const toggleTaskCompletion = async (task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: !task.completed
      });
    } catch (error) {
      console.error("Error updating task", error);
    }
  };

  const saveTaskEdit = async (id) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        title: editingTaskData.title,
        description: editingTaskData.description || '',
        priority: editingTaskData.priority,
        dueDate: editingTaskData.dueDate || ''
      });
      setEditingTaskId(null);
    } catch (error) {
      console.error("Error updating task", error);
    }
  };

  const softDeleteTask = async (id) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        deleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error deleting task", error);
    }
  };

  const restoreTask = async (id) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        deleted: false
      });
    } catch (error) {
      console.error("Error restoring task", error);
    }
  };

  const permanentlyDeleteTask = async (id) => {
    if (confirm("Are you sure you want to permanently delete this task? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch (error) {
        console.error("Error permanently deleting task", error);
      }
    }
  };

  // Task Collections
  const activeTasks = tasks.filter(t => !t.deleted);
  const deletedTasks = tasks.filter(t => t.deleted === true);

  const displayedActiveTasks = selectedGoalId === 'all' 
    ? activeTasks 
    : (selectedGoalId === 'deleted' ? [] : activeTasks.filter(t => t.goalId === selectedGoalId));

  const displayedDeletedTasks = selectedGoalId === 'deleted'
    ? deletedTasks
    : (selectedGoalId === 'all'
        ? deletedTasks
        : deletedTasks.filter(t => t.goalId === selectedGoalId));

  const totalActiveCount = activeTasks.length;
  const openTasksCount = activeTasks.filter(t => !t.completed).length;
  const completedTasksCount = activeTasks.filter(t => t.completed).length;
  const deletedTasksCount = deletedTasks.length;

  const isGoalFiltered = selectedGoalId !== 'all' && selectedGoalId !== 'deleted';

  const filteredTotalCount = isGoalFiltered ? displayedActiveTasks.length : totalActiveCount;
  const filteredOpenCount = isGoalFiltered ? displayedActiveTasks.filter(t => !t.completed).length : openTasksCount;
  const filteredCompletedCount = isGoalFiltered ? displayedActiveTasks.filter(t => t.completed).length : completedTasksCount;
  const filteredDeletedCount = isGoalFiltered ? displayedDeletedTasks.length : deletedTasksCount;

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <Target style={{ color: 'var(--primary-color)' }} size={20} />
          <h2>KeepTrack</h2>
        </div>
        <div className="header-actions">
          <span className="user-email">{auth.currentUser?.email}</span>
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => auth.signOut()}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      {/* Top Task Statistics Summary Bar */}
      <div className="stats-summary-container">
        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-total">
            <ListTodo size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{filteredTotalCount}</span>
            {isGoalFiltered && (
              <span className="stat-subtext">Overall: {totalActiveCount}</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-open">
            <Clock size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Open Tasks</span>
            <span className="stat-value">{filteredOpenCount}</span>
            {isGoalFiltered && (
              <span className="stat-subtext">Overall: {openTasksCount}</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-completed">
            <CheckCircle size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Completed Tasks</span>
            <span className="stat-value">{filteredCompletedCount}</span>
            {isGoalFiltered && (
              <span className="stat-subtext">Overall: {completedTasksCount}</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper stat-icon-deleted">
            <Trash2 size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Deleted Tasks</span>
            <span className="stat-value">{filteredDeletedCount}</span>
            {isGoalFiltered && (
              <span className="stat-subtext">Overall: {deletedTasksCount}</span>
            )}
          </div>
        </div>
      </div>

      <main className="main-content">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* Sidebar: Goals & Filters */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ marginBottom: '0.625rem' }}>My Goals</h3>
            
            <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="New Goal Title..." 
                value={newGoalTitle}
                onChange={e => setNewGoalTitle(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <input 
                  type="date" 
                  className="input-field"
                  style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  value={newGoalDate}
                  onChange={e => setNewGoalDate(e.target.value)}
                  title="Due date (optional)"
                />
                <button type="submit" className="btn btn-primary" title="Add Goal" style={{ padding: '0.25rem 0.5rem' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div 
                className={`goal-item ${selectedGoalId === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedGoalId('all');
                  setIsSidebarOpen(false);
                }}
              >
                <div className="goal-title">All Active Tasks</div>
              </div>
              
              {goals.length === 0 ? (
                <div className="empty-state" style={{ padding: '0.75rem' }}>No goals yet. Create one above!</div>
              ) : (
                goals.map(goal => (
                  <div 
                    key={goal.id} 
                    className={`goal-item ${selectedGoalId === goal.id ? 'active' : ''}`}
                    onClick={() => {
                      if (editingGoalId !== goal.id) {
                        setSelectedGoalId(goal.id);
                        setIsSidebarOpen(false);
                      }
                    }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ flex: 1, marginRight: '0.375rem', minWidth: 0 }}>
                      {editingGoalId === goal.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            className="input-field" 
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8125rem' }} 
                            value={editingGoalData.title} 
                            onChange={e => setEditingGoalData({...editingGoalData, title: e.target.value})} 
                          />
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <input 
                              type="date" 
                              className="input-field" 
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', flex: 1 }} 
                              value={editingGoalData.dueDate} 
                              onChange={e => setEditingGoalData({...editingGoalData, dueDate: e.target.value})} 
                            />
                            <button className="btn btn-primary" style={{ padding: '0.2rem 0.4rem' }} onClick={(e) => saveGoalEdit(goal.id, e)}><Check size={12}/></button>
                            <button className="btn" style={{ padding: '0.2rem 0.4rem' }} onClick={(e) => { e.stopPropagation(); setEditingGoalId(null); }}><X size={12}/></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="goal-title">{goal.title}</div>
                          <div className="goal-date">
                            {goal.dueDate ? `Due: ${format(new Date(goal.dueDate), 'MMM d, yyyy')}` : 'No date set'}
                          </div>
                        </>
                      )}
                    </div>
                    {editingGoalId !== goal.id && (
                      <div className="goal-actions">
                        <button 
                          className="btn-icon" 
                          title="Edit goal"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingGoalId(goal.id); 
                            setEditingGoalData({ title: goal.title, dueDate: goal.dueDate || '' }); 
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          className="btn-icon btn-icon-danger" 
                          title="Delete goal"
                          onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Trash / Deleted Tasks Sidebar Nav */}
              <div 
                className={`goal-item ${selectedGoalId === 'deleted' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedGoalId('deleted');
                  setIsSidebarOpen(false);
                }}
                style={{ 
                  marginTop: '0.5rem', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '0.5rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}
              >
                <div className="goal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: selectedGoalId === 'deleted' ? 'var(--danger-color)' : 'inherit' }}>
                  <Trash2 size={14} color={selectedGoalId === 'deleted' ? 'var(--danger-color)' : 'var(--text-secondary)'} /> 
                  Deleted Tasks
                </div>
                <span className="priority-badge priority-high" style={{ fontSize: '0.7rem', padding: '0.05rem 0.35rem' }}>
                  {deletedTasksCount}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Area: Tasks */}
        <section>
          {selectedGoalId === 'deleted' ? (
            /* Deleted Tasks List View */
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Trash2 size={18} color="var(--danger-color)" />
                  <h3>Deleted Tasks (Trash)</h3>
                </div>
                <span className="goal-date">
                  {displayedDeletedTasks.length} {displayedDeletedTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>

              <div>
                {displayedDeletedTasks.length === 0 ? (
                  <div className="empty-state">No deleted tasks in trash.</div>
                ) : (
                  displayedDeletedTasks.map(task => (
                    <div key={task.id} className="task-item" style={{ opacity: 0.9, borderColor: 'var(--border-color)' }}>
                      <div className="checkbox-container" style={{ opacity: 0.6 }}>
                        <Trash2 size={16} color="var(--danger-color)" />
                      </div>
                      
                      <div className="task-content">
                        <div className="task-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="task-title-text">{task.title}</span>
                          {task.description && (
                            <button 
                              className="btn-icon" 
                              onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id); }}
                              title={expandedTasks.includes(task.id) ? "Hide details" : "Show details"}
                            >
                              {expandedTasks.includes(task.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </div>
                        
                        {expandedTasks.includes(task.id) && task.description && (
                          <div className="task-description">
                            {task.description}
                          </div>
                        )}

                        <div className="task-meta">
                          <span className="task-goal-badge">
                            <Target size={11} /> {goals.find(g => g.id === task.goalId)?.title || 'Unassigned Goal'}
                          </span>
                          <span className={`priority-badge priority-${task.priority?.toLowerCase() || 'low'}`}>
                            {task.priority || 'Low'} Priority
                          </span>
                          {task.dueDate && <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>}
                        </div>
                      </div>

                      <div className="task-actions">
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.725rem' }}
                          onClick={() => restoreTask(task.id)}
                          title="Restore task to active list"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                        <button 
                          className="btn-icon btn-icon-danger" 
                          onClick={() => permanentlyDeleteTask(task.id)}
                          title="Delete permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : selectedGoalId ? (
            /* Active Tasks View */
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                {selectedGoalId === 'all' ? (
                  <h3>All Tasks</h3>
                ) : (
                  editingGoalId === selectedGoalId ? (
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flex: 1, marginRight: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        style={{ flex: 1, fontSize: '0.975rem', fontWeight: 'bold', padding: '0.25rem 0.5rem' }} 
                        value={editingGoalData.title} 
                        onChange={e => setEditingGoalData({...editingGoalData, title: e.target.value})} 
                        autoFocus
                      />
                      <input 
                        type="date" 
                        className="input-field" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                        value={editingGoalData.dueDate} 
                        onChange={e => setEditingGoalData({...editingGoalData, dueDate: e.target.value})} 
                      />
                      <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => saveGoalEdit(selectedGoalId)}><Check size={14}/></button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingGoalId(null)}><X size={14}/></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3>{goals.find(g => g.id === selectedGoalId)?.title}</h3>
                      <button className="btn-icon" title="Edit goal" onClick={() => { 
                        const goal = goals.find(g => g.id === selectedGoalId);
                        setEditingGoalId(selectedGoalId); 
                        setEditingGoalData({ title: goal?.title || '', dueDate: goal?.dueDate || '' }); 
                      }}>
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )
                )}
                {selectedGoalId !== 'all' && editingGoalId !== selectedGoalId && (
                  <span className="goal-date">
                    {goals.find(g => g.id === selectedGoalId)?.dueDate 
                      ? `Due: ${format(new Date(goals.find(g => g.id === selectedGoalId).dueDate), 'MMM d, yyyy')}` 
                      : ''}
                  </span>
                )}
              </div>
              
              {selectedGoalId !== 'all' && (
                <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ flex: 1 }}
                      placeholder="What needs to be done?" 
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      required
                    />
                    <select 
                      className="input-field" 
                      value={newTaskPriority}
                      onChange={e => setNewTaskPriority(e.target.value)}
                      style={{ width: '95px' }}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Med</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <textarea
                    className="input-field"
                    placeholder="Add description or subtasks (optional)..."
                    value={newTaskDescription}
                    onChange={e => setNewTaskDescription(e.target.value)}
                    rows="2"
                    style={{ resize: 'vertical', fontSize: '0.8125rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <input 
                      type="date" 
                      className="input-field" 
                      style={{ flex: 1, fontSize: '0.75rem' }}
                      value={newTaskDate}
                      onChange={e => setNewTaskDate(e.target.value)}
                      title="Due date (optional)"
                    />
                    <button type="submit" className="btn btn-primary" style={{ minWidth: '95px' }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </form>
              )}

              <div>
                {displayedActiveTasks.length === 0 ? (
                  <div className="empty-state">No tasks for this goal yet. Add one above!</div>
                ) : (
                  displayedActiveTasks.map(task => (
                    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                      <div className="checkbox-container" onClick={() => toggleTaskCompletion(task)}>
                        {task.completed ? (
                          <CheckCircle size={18} color="var(--success-color)" />
                        ) : (
                          <Circle size={18} color="var(--text-secondary)" />
                        )}
                      </div>
                      
                      <div className="task-content">
                        {editingTaskId === task.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1 }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} 
                              value={editingTaskData.title} 
                              onChange={e => setEditingTaskData({...editingTaskData, title: e.target.value})} 
                            />
                            <textarea
                              className="input-field"
                              placeholder="Description..."
                              value={editingTaskData.description}
                              onChange={e => setEditingTaskData({...editingTaskData, description: e.target.value})}
                              rows="2"
                              style={{ resize: 'vertical', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                              <select 
                                className="input-field" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto' }} 
                                value={editingTaskData.priority} 
                                onChange={e => setEditingTaskData({...editingTaskData, priority: e.target.value})}
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Med</option>
                                <option value="High">High</option>
                              </select>
                              <input 
                                type="date" 
                                className="input-field" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', flex: 1 }} 
                                value={editingTaskData.dueDate} 
                                onChange={e => setEditingTaskData({...editingTaskData, dueDate: e.target.value})} 
                              />
                              <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => saveTaskEdit(task.id)}><Check size={12}/> Save</button>
                              <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setEditingTaskId(null)}><X size={12}/> Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="task-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="task-title-text">{task.title}</span>
                              {task.description && (
                                <button 
                                  className="btn-icon" 
                                  style={{ marginLeft: '0.375rem' }} 
                                  onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id); }}
                                  title={expandedTasks.includes(task.id) ? "Hide details" : "Show details"}
                                >
                                  {expandedTasks.includes(task.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </div>
                            
                            {expandedTasks.includes(task.id) && task.description && (
                              <div className="task-description">
                                {task.description}
                              </div>
                            )}

                            <div className="task-meta">
                              {selectedGoalId === 'all' && task.goalId && (
                                <span className="task-goal-badge">
                                  <Target size={11} /> {goals.find(g => g.id === task.goalId)?.title || 'Unknown Goal'}
                                </span>
                              )}
                              <span className={`priority-badge priority-${task.priority?.toLowerCase() || 'low'}`}>
                                {task.priority || 'Low'} Priority
                              </span>
                              {task.dueDate && <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>}
                            </div>
                          </>
                        )}
                      </div>

                      {editingTaskId !== task.id && (
                        <div className="task-actions">
                          <button 
                            className="btn-icon" 
                            title="Edit task"
                            onClick={() => { 
                              setEditingTaskId(task.id); 
                              setEditingTaskData({ title: task.title, description: task.description || '', priority: task.priority || 'Low', dueDate: task.dueDate || '' }); 
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn-icon btn-icon-danger" 
                            title="Move to trash"
                            onClick={() => softDeleteTask(task.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <div className="empty-state">Select or create a goal to view tasks.</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

