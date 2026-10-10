import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { LogOut, Plus, Trash2, CheckCircle, Circle, Target, Edit2, X, Check, Menu, ChevronDown, ChevronUp, ChevronRight, ListTodo, Clock, RotateCcw, Play } from 'lucide-react';
import { format } from 'date-fns';

const priorityWeight = { High: 3, Medium: 2, Low: 1 };

const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};

export default function Dashboard() {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all'); // 'all' | 'open' | 'completed' | 'deleted'

  // Forms — top-level goal
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');

  // Forms — subgoal inline
  const [newSubgoalParentId, setNewSubgoalParentId] = useState(null);
  const [newSubgoalTitle, setNewSubgoalTitle] = useState('');
  const [newSubgoalDate, setNewSubgoalDate] = useState('');

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
  const [expandedGoals, setExpandedGoals] = useState([]); // goal IDs whose subgoals are visible

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleGoalExpansion = (goalId, e) => {
    e.stopPropagation();
    setExpandedGoals(prev =>
      prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
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
      setTasks(tasksData);
    }, (error) => {
      console.error("Error listening to tasks:", error);
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  // ── Goal Hierarchy Helpers ───────────────────────────────────────────────────
  const topLevelGoals = goals.filter(g => !g.parentGoalId);
  const subgoalsOf = (parentId) => goals.filter(g => g.parentGoalId === parentId);

  // Returns goal + parent info for breadcrumb
  const getGoalBreadcrumb = (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return null;
    if (goal.parentGoalId) {
      const parent = goals.find(g => g.id === goal.parentGoalId);
      return { goalTitle: goal.title, parentTitle: parent?.title || null };
    }
    return { goalTitle: goal.title, parentTitle: null };
  };

  // Returns the currently selected goal (null if 'all'/'deleted')
  const selectedGoal = goals.find(g => g.id === selectedGoalId) || null;
  const selectedGoalParent = selectedGoal?.parentGoalId
    ? goals.find(g => g.id === selectedGoal.parentGoalId) || null
    : null;

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleAddGoal = async (e, parentGoalId = null) => {
    e.preventDefault();
    const title = parentGoalId ? newSubgoalTitle : newGoalTitle;
    const date = parentGoalId ? newSubgoalDate : newGoalDate;
    if (!title.trim()) return;
    try {
      const payload = {
        userId: auth.currentUser.uid,
        title: title.trim(),
        dueDate: date || '',
        createdAt: serverTimestamp(),
      };
      if (parentGoalId) payload.parentGoalId = parentGoalId;

      const docRef = await addDoc(collection(db, 'goals'), payload);

      if (parentGoalId) {
        // Auto-expand parent & select the new subgoal
        setExpandedGoals(prev => prev.includes(parentGoalId) ? prev : [...prev, parentGoalId]);
        setSelectedGoalId(docRef.id);
        setNewSubgoalTitle('');
        setNewSubgoalDate('');
        setNewSubgoalParentId(null);
      } else {
        setSelectedGoalId(docRef.id);
        setNewGoalTitle('');
        setNewGoalDate('');
      }
    } catch (error) {
      console.error("Error adding goal", error);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (confirm("Are you sure you want to delete this goal and all its tasks?")) {
      // Also delete subgoals
      const children = subgoalsOf(id);
      for (const child of children) {
        await deleteDoc(doc(db, 'goals', child.id));
      }
      await deleteDoc(doc(db, 'goals', id));
      if (selectedGoalId === id || children.some(c => c.id === selectedGoalId)) {
        setSelectedGoalId('all');
      }
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
        dueDate: newTaskDate || '',
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

  const toggleTaskInProgress = async (task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        inProgress: !task.inProgress
      });
    } catch (error) {
      console.error("Error toggling in-progress", error);
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

  // ── Task Collections & Sorting (Option 2: Urgency-First | Approach B: Flat List with Goal Tie-Breaker) ──
  const sortedTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const goalNameMap = {};
    goals.forEach(g => {
      goalNameMap[g.id] = (g.title || '').trim().toLowerCase();
    });

    return [...tasks].sort((a, b) => {
      // 1. Completion: Incomplete tasks float above completed tasks
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // If both completed, sort chronologically by dueDate then priority
      if (a.completed && b.completed) {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        const pA = priorityWeight[a.priority] || 1;
        const pB = priorityWeight[b.priority] || 1;
        if (pA !== pB) return pB - pA;
        return 0;
      }

      // Tiers for active tasks:
      // Tier 1: Overdue or Due Today (dueDate <= todayStr)
      // Tier 2: In-Progress (future due date or no due date)
      // Tier 3: Upcoming Due Date (dueDate > todayStr)
      // Tier 4: No Due Date
      const getTier = (t) => {
        if (t.dueDate && t.dueDate <= todayStr) return 1;
        if (t.inProgress) return 2;
        if (t.dueDate) return 3;
        return 4;
      };

      const tierA = getTier(a);
      const tierB = getTier(b);

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // Inside Tier 1 (Overdue / Due Today):
      if (tierA === 1) {
        // In-progress tasks among overdue/today float to the top
        const aIP = !!a.inProgress;
        const bIP = !!b.inProgress;
        if (aIP !== bIP) return aIP ? -1 : 1;

        // Chronological: earliest overdue date first
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
      }

      // Inside Tier 2 (In-Progress):
      if (tierA === 2) {
        // In-progress with due date comes before in-progress without due date
        const aHasDue = !!a.dueDate;
        const bHasDue = !!b.dueDate;
        if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

        // If both have due date, earliest first
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
      }

      // Inside Tier 3 (Upcoming Due Dates):
      if (tierA === 3) {
        // Chronological: earliest due date first
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
      }

      // Common tie-breakers:
      // 1. Priority (High > Medium > Low)
      const priorityA = priorityWeight[a.priority] || 1;
      const priorityB = priorityWeight[b.priority] || 1;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // 2. Goal Name (Alphabetical A to Z)
      const goalA = goalNameMap[a.goalId] || '';
      const goalB = goalNameMap[b.goalId] || '';
      if (goalA !== goalB) {
        return goalA.localeCompare(goalB);
      }

      // 3. Creation Time (Oldest first)
      const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // 4. Title fallback
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [tasks, goals]);

  const activeTasks = sortedTasks.filter(t => !t.deleted);
  const deletedTasks = [...tasks]
    .filter(t => t.deleted === true)
    .sort((a, b) => {
      const timeA = typeof a.deletedAt?.toMillis === 'function' ? a.deletedAt.toMillis() : (a.deletedAt?.seconds ? a.deletedAt.seconds * 1000 : 0);
      const timeB = typeof b.deletedAt?.toMillis === 'function' ? b.deletedAt.toMillis() : (b.deletedAt?.seconds ? b.deletedAt.seconds * 1000 : 0);
      return timeB - timeA;
    });

  const selectedSubgoalIds = useMemo(() => {
    if (!selectedGoalId || selectedGoalId === 'all' || selectedGoalId === 'deleted') return [];
    return goals.filter(g => g.parentGoalId === selectedGoalId).map(s => s.id);
  }, [selectedGoalId, goals]);

  // ── Goal Progress Calculation ────────────────────────────────────────────────
  const getGoalStats = (goalId) => {
    const subgoals = subgoalsOf(goalId);
    const treeGoalIds = [goalId, ...subgoals.map(s => s.id)];
    const goalTasks = activeTasks.filter(t => treeGoalIds.includes(t.goalId));
    const total = goalTasks.length;
    const completed = goalTasks.filter(t => t.completed).length;
    const inProgress = goalTasks.filter(t => !t.completed && !!t.inProgress).length;
    const open = goalTasks.filter(t => !t.completed && !t.inProgress).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      inProgress,
      open,
      percent,
      subgoalsCount: subgoals.length,
    };
  };

  const goalActiveTasks = selectedGoalId === 'all'
    ? activeTasks
    : (selectedGoalId === 'deleted'
        ? activeTasks
        : activeTasks.filter(t => t.goalId === selectedGoalId || selectedSubgoalIds.includes(t.goalId)));

  const goalDeletedTasks = selectedGoalId === 'deleted'
    ? deletedTasks
    : (selectedGoalId === 'all'
        ? deletedTasks
        : deletedTasks.filter(t => t.goalId === selectedGoalId || selectedSubgoalIds.includes(t.goalId)));

  const displayedActiveTasks = goalActiveTasks.filter(t => {
    if (taskStatusFilter === 'open') return !t.completed && !t.inProgress;
    if (taskStatusFilter === 'in-progress') return !!t.inProgress && !t.completed;
    if (taskStatusFilter === 'completed') return t.completed;
    return true;
  });

  const displayedDeletedTasks = goalDeletedTasks;

  const totalActiveCount = activeTasks.length;
  const openTasksCount = activeTasks.filter(t => !t.completed && !t.inProgress).length;
  const inProgressCount = activeTasks.filter(t => !!t.inProgress && !t.completed).length;
  const completedTasksCount = activeTasks.filter(t => t.completed).length;
  const deletedTasksCount = deletedTasks.length;

  const isGoalFiltered = selectedGoalId !== 'all' && selectedGoalId !== 'deleted';

  const filteredTotalCount = isGoalFiltered ? goalActiveTasks.length : totalActiveCount;
  const filteredOpenCount = isGoalFiltered ? goalActiveTasks.filter(t => !t.completed && !t.inProgress).length : openTasksCount;
  const filteredInProgressCount = isGoalFiltered ? goalActiveTasks.filter(t => !!t.inProgress && !t.completed).length : inProgressCount;
  const filteredCompletedCount = isGoalFiltered ? goalActiveTasks.filter(t => t.completed).length : completedTasksCount;
  const filteredDeletedCount = isGoalFiltered ? goalDeletedTasks.length : deletedTasksCount;

  const handleSelectTotalFilter = () => {
    setTaskStatusFilter('all');
    if (selectedGoalId === 'deleted') setSelectedGoalId('all');
  };

  const handleSelectOpenFilter = () => {
    setTaskStatusFilter('open');
    if (selectedGoalId === 'deleted') setSelectedGoalId('all');
  };

  const handleSelectInProgressFilter = () => {
    setTaskStatusFilter('in-progress');
    if (selectedGoalId === 'deleted') setSelectedGoalId('all');
  };

  const handleSelectCompletedFilter = () => {
    setTaskStatusFilter('completed');
    if (selectedGoalId === 'deleted') setSelectedGoalId('all');
  };

  const handleSelectDeletedFilter = () => {
    setTaskStatusFilter('deleted');
    setSelectedGoalId('deleted');
  };

  // ── Sub-components ───────────────────────────────────────────────────────────

  // Task goal breadcrumb badge
  const TaskGoalBadge = ({ task }) => {
    const crumb = getGoalBreadcrumb(task.goalId);
    if (!crumb) return null;
    return (
      <span className="task-goal-badge">
        <Target size={11} />
        {crumb.parentTitle ? (
          <>
            <span className="task-goal-parent">{crumb.parentTitle}</span>
            <span className="task-goal-sep">›</span>
            <span>{crumb.goalTitle}</span>
          </>
        ) : (
          crumb.goalTitle
        )}
      </span>
    );
  };

  const renderTaskDueDate = (task) => {
    if (!task.dueDate) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const parsedDate = parseLocalDate(task.dueDate);
    const formattedDate = format(parsedDate, 'MMM d, yyyy');

    if (task.completed || task.deleted) {
      return <span>Due: {formattedDate}</span>;
    }

    if (task.dueDate < todayStr) {
      return <span className="due-overdue" title="Overdue task">Overdue: {formattedDate}</span>;
    }

    if (task.dueDate === todayStr) {
      return <span className="due-today" title="Due today">Due Today: {formattedDate}</span>;
    }

    return <span>Due: {formattedDate}</span>;
  };

  // Single goal row in sidebar (shared by top-level + subgoal)
  const GoalRow = ({ goal, isSubgoal = false }) => {
    const isActive = selectedGoalId === goal.id;
    const isEditing = editingGoalId === goal.id;
    const children = subgoalsOf(goal.id);
    const isExpanded = expandedGoals.includes(goal.id);
    const stats = getGoalStats(goal.id);

    return (
      <div className={isSubgoal ? 'subgoal-group' : 'goal-group'}>
        <div
          className={`goal-item ${isActive ? 'active' : ''} ${isSubgoal ? 'goal-item-sub' : ''}`}
          onClick={() => {
            if (!isEditing) {
              setSelectedGoalId(goal.id);
              setIsSidebarOpen(false);
            }
          }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          {/* Expand/collapse chevron — only on top-level goals */}
          {!isSubgoal && (
            <button
              className="goal-expand-btn"
              onClick={(e) => toggleGoalExpansion(goal.id, e)}
              title={isExpanded ? 'Collapse subgoals' : 'Expand subgoals'}
              style={{ marginTop: '0.15rem' }}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}

          <div style={{ flex: 1, marginRight: '0.375rem', minWidth: 0 }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.8125rem' }}
                  value={editingGoalData.title}
                  onChange={e => setEditingGoalData({ ...editingGoalData, title: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="date"
                    className="input-field"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', flex: 1 }}
                    value={editingGoalData.dueDate}
                    onChange={e => setEditingGoalData({ ...editingGoalData, dueDate: e.target.value })}
                  />
                  <button className="btn btn-primary" style={{ padding: '0.2rem 0.4rem' }} onClick={(e) => saveGoalEdit(goal.id, e)}><Check size={12} /></button>
                  <button className="btn" style={{ padding: '0.2rem 0.4rem' }} onClick={(e) => { e.stopPropagation(); setEditingGoalId(null); }}><X size={12} /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="goal-title">{goal.title}</div>
                <div className="goal-date">
                  {goal.dueDate ? `Due: ${format(new Date(goal.dueDate), 'MMM d, yyyy')}` : 'No date set'}
                </div>
                {stats.total > 0 ? (
                  <div className="goal-mini-progress-wrapper">
                    <div className="goal-mini-progress-track">
                      <div
                        className={`goal-mini-progress-fill ${stats.percent === 100 ? 'complete' : ''}`}
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                    <div className="goal-mini-progress-info">
                      <span>{stats.completed}/{stats.total} done</span>
                      <span className={`goal-mini-progress-percent ${stats.percent === 100 ? 'complete' : ''}`}>
                        {stats.percent}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="goal-progress-empty">0 tasks</div>
                )}
              </>
            )}
          </div>

          {!isEditing && (
            <div className="goal-actions" style={{ marginTop: '0.15rem' }}>
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

        {/* Subgoal children list (only on top-level goals) */}
        {!isSubgoal && isExpanded && (
          <div className="subgoal-list">
            {children.map(sub => (
              <GoalRow key={sub.id} goal={sub} isSubgoal={true} />
            ))}

            {/* Add subgoal inline form */}
            {newSubgoalParentId === goal.id ? (
              <form
                className="subgoal-add-form"
                onSubmit={(e) => handleAddGoal(e, goal.id)}
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="text"
                  className="input-field"
                  placeholder="Subgoal title..."
                  value={newSubgoalTitle}
                  onChange={e => setNewSubgoalTitle(e.target.value)}
                  autoFocus
                  required
                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                />
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="date"
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                    value={newSubgoalDate}
                    onChange={e => setNewSubgoalDate(e.target.value)}
                    title="Due date (optional)"
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}>
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    onClick={(e) => { e.stopPropagation(); setNewSubgoalParentId(null); setNewSubgoalTitle(''); setNewSubgoalDate(''); }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="subgoal-add-btn"
                onClick={(e) => { e.stopPropagation(); setNewSubgoalParentId(goal.id); }}
                title="Add subgoal"
              >
                <Plus size={11} /> Add subgoal
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Header breadcrumb for selected goal ──────────────────────────────────────
  const renderMainHeader = () => {
    if (selectedGoalId === 'all') {
      return (
        <h3>
          {taskStatusFilter === 'open' ? 'Open Tasks' : taskStatusFilter === 'completed' ? 'Completed Tasks' : 'All Tasks'}
        </h3>
      );
    }

    if (editingGoalId === selectedGoalId) {
      return (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flex: 1, marginRight: '0.5rem' }}>
          <input
            type="text"
            className="input-field"
            style={{ flex: 1, fontSize: '0.975rem', fontWeight: 'bold', padding: '0.25rem 0.5rem' }}
            value={editingGoalData.title}
            onChange={e => setEditingGoalData({ ...editingGoalData, title: e.target.value })}
            autoFocus
          />
          <input
            type="date"
            className="input-field"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            value={editingGoalData.dueDate}
            onChange={e => setEditingGoalData({ ...editingGoalData, dueDate: e.target.value })}
          />
          <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => saveGoalEdit(selectedGoalId)}><Check size={14} /></button>
          <button className="btn" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingGoalId(null)}><X size={14} /></button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {selectedGoalParent && (
          <>
            <span className="main-header-parent" onClick={() => setSelectedGoalId(selectedGoalParent.id)} title={`Go to ${selectedGoalParent.title}`}>
              {selectedGoalParent.title}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          </>
        )}
        <h3 style={{ margin: 0 }}>
          {selectedGoal?.title}
          {taskStatusFilter === 'open' ? ' (Open)' : taskStatusFilter === 'completed' ? ' (Completed)' : ''}
        </h3>
        <button className="btn-icon" title="Edit goal" onClick={() => {
          setEditingGoalId(selectedGoalId);
          setEditingGoalData({ title: selectedGoal?.title || '', dueDate: selectedGoal?.dueDate || '' });
        }}>
          <Edit2 size={14} />
        </button>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
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

      {/* Top Task Statistics Summary Bar (Acts as Filters) */}
      <div className="stats-summary-container">
        <div
          className={`stat-card stat-card-total ${taskStatusFilter === 'all' && selectedGoalId !== 'deleted' ? 'active' : ''}`}
          onClick={handleSelectTotalFilter}
          title="Filter by All Tasks"
        >
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

        <div
          className={`stat-card stat-card-open ${taskStatusFilter === 'open' && selectedGoalId !== 'deleted' ? 'active' : ''}`}
          onClick={handleSelectOpenFilter}
          title="Filter by Open Tasks"
        >
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

        <div
          className={`stat-card stat-card-inprogress ${taskStatusFilter === 'in-progress' && selectedGoalId !== 'deleted' ? 'active' : ''}`}
          onClick={handleSelectInProgressFilter}
          title="Filter by In-Progress Tasks"
        >
          <div className="stat-icon-wrapper stat-icon-inprogress">
            <Play size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">In-Progress</span>
            <span className="stat-value">{filteredInProgressCount}</span>
            {isGoalFiltered && (
              <span className="stat-subtext">Overall: {inProgressCount}</span>
            )}
          </div>
        </div>

        <div
          className={`stat-card stat-card-completed ${taskStatusFilter === 'completed' && selectedGoalId !== 'deleted' ? 'active' : ''}`}
          onClick={handleSelectCompletedFilter}
          title="Filter by Completed Tasks"
        >
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

        <div
          className={`stat-card stat-card-deleted ${taskStatusFilter === 'deleted' || selectedGoalId === 'deleted' ? 'active' : ''}`}
          onClick={handleSelectDeletedFilter}
          title="Filter by Deleted Tasks"
        >
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

            <form onSubmit={(e) => handleAddGoal(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
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
              {/* All Active Tasks */}
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
                topLevelGoals.map(goal => (
                  <GoalRow key={goal.id} goal={goal} isSubgoal={false} />
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
                          <TaskGoalBadge task={task} />
                          <span className={`priority-badge priority-${task.priority?.toLowerCase() || 'low'}`}>
                            {task.priority || 'Low'} Priority
                          </span>
                          {renderTaskDueDate(task)}
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
                {renderMainHeader()}
                {selectedGoalId !== 'all' && editingGoalId !== selectedGoalId && (
                  <span className="goal-date">
                    {selectedGoal?.dueDate
                      ? `Due: ${format(new Date(selectedGoal.dueDate), 'MMM d, yyyy')}`
                      : ''}
                  </span>
                )}
              </div>

              {/* Goal Progress Banner Card for Selected Goal */}
              {selectedGoalId !== 'all' && selectedGoal && (() => {
                const selectedStats = getGoalStats(selectedGoal.id);
                return (
                  <div className={`goal-progress-card ${selectedStats.percent === 100 && selectedStats.total > 0 ? 'complete' : ''}`}>
                    <div className="goal-progress-card-top">
                      <div className="goal-progress-card-info">
                        <div className="goal-progress-status-badge">
                          {selectedStats.total === 0 ? (
                            <span className="badge-not-started"><Clock size={12} /> No tasks yet</span>
                          ) : selectedStats.percent === 100 ? (
                            <span className="badge-complete"><CheckCircle size={12} /> Milestone Achieved</span>
                          ) : selectedStats.inProgress > 0 ? (
                            <span className="badge-progress"><Play size={12} /> In Progress ({selectedStats.inProgress} active)</span>
                          ) : (
                            <span className="badge-progress"><Target size={12} /> Goal In Progress</span>
                          )}
                        </div>
                        <div className="goal-progress-card-subtitle">
                          {selectedStats.total === 0 ? (
                            <span>Add tasks below to start tracking real-time progress for this milestone.</span>
                          ) : (
                            <span>
                              <strong>{selectedStats.completed}</strong> of <strong>{selectedStats.total}</strong> tasks completed
                              {selectedStats.open > 0 && ` (${selectedStats.open} remaining)`}
                              {selectedStats.subgoalsCount > 0 && ` • across ${selectedStats.subgoalsCount} subgoals`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`goal-progress-metric-pill ${selectedStats.percent === 100 && selectedStats.total > 0 ? 'complete' : ''}`}>
                        <span className={`goal-progress-number ${selectedStats.percent === 100 && selectedStats.total > 0 ? 'complete' : ''}`}>
                          {selectedStats.percent}%
                        </span>
                        <span className="goal-progress-label">done</span>
                      </div>
                    </div>
                    <div className="goal-progress-track">
                      <div
                        className={`goal-progress-bar ${selectedStats.percent === 100 && selectedStats.total > 0 ? 'complete' : ''}`}
                        style={{ width: `${selectedStats.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Overall Progress for All Tasks View */}
              {selectedGoalId === 'all' && totalActiveCount > 0 && (
                <div className="overall-progress-card">
                  <div className="overall-progress-info">
                    <span>
                      Overall Completion: <strong>{Math.round((completedTasksCount / totalActiveCount) * 100)}%</strong>
                    </span>
                    <span>
                      <strong>{completedTasksCount}</strong> of <strong>{totalActiveCount}</strong> tasks finished
                    </span>
                  </div>
                  <div className="overall-progress-track">
                    <div
                      className="overall-progress-fill"
                      style={{ width: `${Math.round((completedTasksCount / totalActiveCount) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

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
                  <div className="empty-state">
                    {taskStatusFilter === 'open'
                      ? 'No open tasks matching this view.'
                      : taskStatusFilter === 'in-progress'
                      ? 'No in-progress tasks matching this view.'
                      : taskStatusFilter === 'completed'
                      ? 'No completed tasks matching this view.'
                      : 'No tasks for this view yet.'}
                  </div>
                ) : (
                  displayedActiveTasks.map(task => (
                    <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${task.inProgress && !task.completed ? 'in-progress' : ''}`}>
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
                              onChange={e => setEditingTaskData({ ...editingTaskData, title: e.target.value })}
                            />
                            <textarea
                              className="input-field"
                              placeholder="Description..."
                              value={editingTaskData.description}
                              onChange={e => setEditingTaskData({ ...editingTaskData, description: e.target.value })}
                              rows="2"
                              style={{ resize: 'vertical', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                              <select
                                className="input-field"
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto' }}
                                value={editingTaskData.priority}
                                onChange={e => setEditingTaskData({ ...editingTaskData, priority: e.target.value })}
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
                                onChange={e => setEditingTaskData({ ...editingTaskData, dueDate: e.target.value })}
                              />
                              <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => saveTaskEdit(task.id)}><Check size={12} /> Save</button>
                              <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setEditingTaskId(null)}><X size={12} /> Cancel</button>
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
                              <TaskGoalBadge task={task} />
                              {task.inProgress && !task.completed && (
                                <span className="inprogress-badge"><Play size={10} /> In-Progress</span>
                              )}
                              <span className={`priority-badge priority-${task.priority?.toLowerCase() || 'low'}`}>
                                {task.priority || 'Low'} Priority
                              </span>
                              {renderTaskDueDate(task)}
                            </div>
                          </>
                        )}
                      </div>

                      {editingTaskId !== task.id && (
                        <div className="task-actions">
                          <button
                            className={`btn-icon ${task.inProgress && !task.completed ? 'btn-icon-inprogress' : ''}`}
                            title={task.inProgress ? 'Mark as Open' : 'Mark In-Progress'}
                            onClick={() => toggleTaskInProgress(task)}
                          >
                            <Play size={14} />
                          </button>
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
