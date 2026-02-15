/**
 * Student Session Storage Utilities
 * Manages localStorage for student session persistence
 */

const SESSION_KEY = 'studentSession';

/**
 * Save student session to localStorage
 */
export const saveStudentSession = (sessionData) => {
    try {
        const data = {
            ...sessionData,
            lastUpdate: Date.now()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save session:', error);
    }
};

/**
 * Get student session from localStorage
 */
export const getStudentSession = () => {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to get session:', error);
        return null;
    }
};

/**
 * Clear student session from localStorage
 */
export const clearStudentSession = () => {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (error) {
        console.error('Failed to clear session:', error);
    }
};

/**
 * Update code in existing session
 */
export const updateSessionCode = (html, css) => {
    try {
        const session = getStudentSession();
        if (session) {
            saveStudentSession({
                ...session,
                html,
                css
            });
        }
    } catch (error) {
        console.error('Failed to update session code:', error);
    }
};
