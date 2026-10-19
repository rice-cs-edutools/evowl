package edu.rice.evowl.mapper;

import java.util.List;

import edu.rice.evowl.entity.DynamicPeerEvalSubmission;
import edu.rice.evowl.mapper.providers.PeerEvalSubmissionSqlProvider;
import org.apache.ibatis.annotations.InsertProvider;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.SelectProvider;

public interface DynamicPeerEvalSubmissionMapper {
    @InsertProvider(type = PeerEvalSubmissionSqlProvider.class, method = "insertDynamic")
    void saveDynamicScoreRecord(DynamicPeerEvalSubmission dynamicPeerEvalSubmission);

    @SelectProvider(type = PeerEvalSubmissionSqlProvider.class, method = "selectAllFromAssignment")
    List<DynamicPeerEvalSubmission> getAllByAssignmentId(@Param("assignId") long assignId);
}
