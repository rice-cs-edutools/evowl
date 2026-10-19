package edu.rice.evowl.mapper.providers;

import edu.rice.evowl.entity.TrainingSubmission;
import org.apache.ibatis.jdbc.SQL;

/**
 * Provide SQL methods for training evaluation tables.
 *
 * Each assignment has a separate training evaluation table, each of
 * which is named training_eval_submission_ASSIGNID, where ASSIGNID is
 * the id of the assignment.
 */
public class TrainingSubmissionSqlProvider {


    public String insertDynamic(TrainingSubmission trainingSubmission) {
        String command = new SQL() {{
            String sub = trainingSubmission.getSubmission_id();
            INSERT_INTO("training_submission_" + "#{assign_id}");
            VALUES("submission_id", "#{submission_id}");
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
