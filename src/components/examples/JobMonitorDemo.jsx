import React, { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useJobMonitor, useJobCreator } from '../../lib/useJobMonitor';
import JobProgress from '../common/JobProgress';

/**
 * Demo component showing how to use the job monitoring system
 * This demonstrates creating jobs, monitoring progress, and handling completion
 */
export default function JobMonitorDemo() {
  const { createJob, updateJobProgress } = useSupabase();
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobType, setJobType] = useState('data_import');
  const [jobPayload, setJobPayload] = useState('{"source": "demo", "records": 1000}');

  // Monitor the current job
  const { job, isSubscribed, error: monitorError } = useJobMonitor(
    currentJobId,
    (updatedJob) => {
      console.log('Job progress update:', updatedJob);
    },
    (completedJob) => {
      console.log('Job completed:', completedJob);
      alert(`Job completed! Result: ${JSON.stringify(completedJob.result)}`);
    },
    (failedJob) => {
      console.error('Job failed:', failedJob);
      alert(`Job failed: ${failedJob.error_details?.message || 'Unknown error'}`);
    }
  );

  // Alternative: Use the job creator hook
  const {
    createJob: createJobViaHook,
    isCreating,
    jobId: hookJobId,
    job: hookJob
  } = useJobCreator(
    jobType,
    JSON.parse(jobPayload || '{}'),
    (progressJob) => console.log('Hook progress:', progressJob),
    (completedJob) => console.log('Hook completed:', completedJob),
    (errorJob) => console.error('Hook error:', errorJob)
  );

  const handleCreateJob = async () => {
    try {
      const payload = JSON.parse(jobPayload || '{}');
      const newJob = await createJob(jobType, payload);
      setCurrentJobId(newJob.id);
      console.log('Created job:', newJob);
    } catch (err) {
      console.error('Error creating job:', err);
      alert('Error creating job: ' + err.message);
    }
  };

  const handleSimulateProgress = async () => {
    if (!currentJobId) return;

    // Simulate job progress updates
    const steps = [10, 25, 50, 75, 90, 100];
    let stepIndex = 0;

    const interval = setInterval(async () => {
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        // Mark as completed
        await updateJobProgress(currentJobId, 100, 'Job completed successfully', 'completed');
        return;
      }

      const progress = steps[stepIndex];
      const message = `Processing step ${stepIndex + 1}/${steps.length}`;

      try {
        await updateJobProgress(currentJobId, progress, message, 'running');
        stepIndex++;
      } catch (err) {
        console.error('Error updating progress:', err);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleCancelJob = async () => {
    if (!currentJobId) return;

    try {
      await updateJobProgress(currentJobId, job?.progress || 0, 'Job cancelled by user', 'cancelled');
      console.log('Job cancelled');
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  const handleCreateViaHook = async () => {
    try {
      await createJobViaHook();
      setCurrentJobId(hookJobId);
    } catch (err) {
      console.error('Error creating job via hook:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Job Monitoring Demo</h2>
        <p className="text-gray-600 mb-6">
          This demo shows how to create and monitor long-running jobs with realtime progress updates.
        </p>

        {/* Job Creation Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Type
            </label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="data_import">Data Import</option>
              <option value="report_generation">Report Generation</option>
              <option value="ai_processing">AI Processing</option>
              <option value="file_upload">File Upload</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Payload (JSON)
            </label>
            <textarea
              value={jobPayload}
              onChange={(e) => setJobPayload(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
              rows={3}
              placeholder='{"source": "demo", "records": 1000}'
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleCreateJob}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Job
            </button>

            <button
              onClick={handleCreateViaHook}
              disabled={isCreating}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create via Hook'}
            </button>
          </div>
        </div>

        {/* Current Job Display */}
        {(job || hookJob) && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Current Job</h3>
            <JobProgress
              job={job || hookJob}
              onCancel={handleCancelJob}
              onRetry={() => setCurrentJobId(null)}
            />

            <div className="flex space-x-3">
              <button
                onClick={handleSimulateProgress}
                disabled={!currentJobId || job?.status === 'completed' || job?.status === 'failed'}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                Simulate Progress
              </button>

              <button
                onClick={() => setCurrentJobId(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Clear Job
              </button>
            </div>

            {/* Connection Status */}
            <div className="text-sm text-gray-600">
              <div>Realtime Status: {isSubscribed ? '🟢 Connected' : '🔴 Disconnected'}</div>
              {monitorError && (
                <div className="text-red-600">Monitor Error: {monitorError.message}</div>
              )}
            </div>
          </div>
        )}

        {/* Raw Job Data */}
        {(job || hookJob) && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Raw Job Data</h3>
            <pre className="bg-gray-100 p-4 rounded-md text-xs overflow-auto">
              {JSON.stringify(job || hookJob, null, 2)}
            </pre>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Use</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>1. Create a job:</strong> Use <code>createJob(type, payload)</code> to create a new job</p>
            <p><strong>2. Monitor progress:</strong> Use <code>useJobMonitor(jobId)</code> hook to subscribe to updates</p>
            <p><strong>3. Update progress:</strong> Call <code>updateJobProgress(jobId, progress, message, status)</code></p>
            <p><strong>4. Handle completion:</strong> The hook provides callbacks for progress, completion, and errors</p>
            <p><strong>5. Realtime updates:</strong> All job changes are broadcast via Supabase realtime channels</p>
          </div>
        </div>
      </div>
    </div>
  );
}