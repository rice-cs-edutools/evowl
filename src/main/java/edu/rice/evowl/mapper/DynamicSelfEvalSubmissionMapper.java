package edu.rice.evowl.mapper;

import java.util.List;

import edu.rice.evowl.entity.DynamicSelfEvalSubmission;
import edu.rice.evowl.mapper.providers.SelfEvalSubmissionSqlProvider;
import org.apache.ibatis.annotations.InsertProvider;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.SelectProvider;

public interface DynamicSelfEvalSubmissionMapper {
    @InsertProvider(type = SelfEvalSubmissionSqlProvider.class, method = "insertDynamic")
    void saveDynamicScoreRecord(DynamicSelfEvalSubmission dynamicSelfEvalSubmission);

    @SelectProvider(type = SelfEvalSubmissionSqlProvider.class, method = "selectAllFromAssignment")
    List<DynamicSelfEvalSubmission> getAllByAssignmentId(@Param("assignId") long assignId);
}
