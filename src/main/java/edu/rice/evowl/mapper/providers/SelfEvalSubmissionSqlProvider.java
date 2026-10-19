package edu.rice.evowl.mapper.providers;

import edu.rice.evowl.entity.DynamicPeerEvalSubmission;
import edu.rice.evowl.entity.DynamicSelfEvalSubmission;
import org.apache.ibatis.jdbc.SQL;

import java.util.Map;

/**
 * Provide SQL methods for self evaluation tables.
 *
 * Each assignment has a separate self evaluation table, each of which
 * is named self_eval_submission_ASSIGNID, where ASSIGNID is the id of
 * the assignment.
 */
public class SelfEvalSubmissionSqlProvider {

    public String insertDynamic(DynamicSelfEvalSubmission dynamicSelfEvalSubmission) {
        String command = new SQL() {{
            String sub = dynamicSelfEvalSubmission.getSubmission_id();
            int assignId = Integer.parseInt(sub.split("-")[0]);

            System.out.println(assignId);
            INSERT_INTO("self_eval_submission_" + assignId);

            VALUES("submission_id", "#{submission_id}");
            VALUES("unique_id", "#{unique_id}");
            VALUES("submit_time", "#{submit_time}");
            VALUES("choices", "#{choices}");
            VALUES("free_responses", "#{free_responses}");

            // for (Map.Entry<Integer, String> entry : dynamicSelfEvalSubmission.getFree_responses().entrySet()) {
            //     int index = entry.getKey();
            //     String text = entry.getValue();
            //     String column = "free_responses_q" + index;
            //     VALUES(column, "'" + text + "'"); // Quote the string value
            // }
        }}.toString();
        command = command.replaceAll("INSERT INTO", "INSERT IGNORE INTO");
        System.out.println("insert command: " + command);
        return command;
    }

    public String selectAllFromAssignment(long assignId) {
        String command = new SQL() {{
            SELECT("*");
            FROM("self_eval_submission_" + assignId);
        }}.toString();

        System.out.println("select command: " + command);
        return command;
    }
}
