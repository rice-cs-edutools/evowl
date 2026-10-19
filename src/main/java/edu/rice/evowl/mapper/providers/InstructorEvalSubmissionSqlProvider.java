package edu.rice.evowl.mapper.providers;

import edu.rice.evowl.entity.InstructorEvalSubmission;
import org.apache.ibatis.jdbc.SQL;

/**
 * Provide SQL methods for ta eval tables.
 *
 * Each assignment has a separate ta evals table, each of which is
 * named instructor_eval_submission_ASSIGNID, where ASSIGNID is the id
 * of the assignment.
 */
public class InstructorEvalSubmissionSqlProvider {
    public String insertDynamic(InstructorEvalSubmission instructorEvalSubmission) {
        String command = new SQL() {{
            String sub = instructorEvalSubmission.getSubmission_id();
            int assignId = Integer.parseInt(sub.split("-")[0]);

            System.out.println(assignId);
            INSERT_INTO("instructor_eval_submission_" + assignId);

            VALUES("submission_id", "#{submission_id}");
            VALUES("deductions", "#{deductions}");
            VALUES("unique_id", "#{unique_id}");
            VALUES("submit_time", "#{submit_time}");
            VALUES("choices", "#{choices}");
            VALUES("free_responses", "#{free_responses}");

        }}.toString();
        command = command.replaceAll("INSERT INTO", "INSERT IGNORE INTO");
        System.out.println("insert command: " + command);
        return command;
    }

}
