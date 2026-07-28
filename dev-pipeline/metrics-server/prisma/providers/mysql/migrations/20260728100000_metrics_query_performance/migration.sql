CREATE INDEX `pipeline_runs_trusted_latest_query_idx`
ON `pipeline_runs`(`developer_id`, `is_latest`, `fingerprint_verified`, `snapshot_source`, `completed_at_pipeline`, `repo_id`);
