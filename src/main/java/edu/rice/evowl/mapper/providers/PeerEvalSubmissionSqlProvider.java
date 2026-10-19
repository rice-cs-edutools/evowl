package edu.rice.evowl.mapper.providers;

import edu.rice.evowl.entity.DynamicPeerEvalSubmission;
import org.apache.ibatis.jdbc.SQL;

import java.util.Map;

/**
 * Provide SQL methods for peer eval tables.
 *
 * Each assignment has a separate peer evals table, each of which is
 * named peer_eval_submission_ASSIGNID, where ASSIGNID is the id of
 * the assignment.
 */
public class PeerEvalSubmissionSqlProvider {

    public String insertDynamic(DynamicPeerEvalSubmission dynamicPeerEvalSubmission) {
        String command = new SQL() {{
            String sub = dynamicPeerEvalSubmission.getSubmission_id2();
            int assignId = Integer.parseInt(sub.split("-")[0]);

            System.out.println(assignId);
            INSERT_INTO("peer_eval_submission_" + assignId);

            VALUES("submission_id1", "#{submission_id1}");
            VALUES("submission_id2", "#{submission_id2}");
            VALUES("unique_id", "#{unique_id}");
            VALUES("submit_time", "#{submit_time}");
            VALUES("choices", "#{choices}");
            VALUES("free_responses", "#{free_responses}");

            // for (Map.Entry<Integer, Map<Integer, String>> entry : dynamicPeerEvalSubmission.getFree_responses().entrySet()) {
            //     int index = entry.getKey();
            //     String s1 = entry.getValue().get(1);
            //     String s2 = entry.getValue().get(2);
            //     String column1 = "free_responses_q" + index + "_s1";
            //     String column2 = "free_responses_q" + index + "_s2";
            //     VALUES(column1, "'" + s1 + "'"); // Quote the string value
            //     VALUES(column2, "'" + s2 + "'");
            // }

        }}.toString();
        command = command.replaceAll("INSERT INTO", "INSERT IGNORE INTO");
        System.out.println("insert command: " + command);
        return command;
    }

    public String selectAllFromAssignment(long assignId) {
        String command = new SQL() {{
            SELECT("*");
            FROM("peer_eval_submission_" + assignId);
        }}.toString();

        System.out.println("select command: " + command);
        return command;
    }
}
