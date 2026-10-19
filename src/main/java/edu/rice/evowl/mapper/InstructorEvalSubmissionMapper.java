package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.InstructorEvalSubmission;
import edu.rice.evowl.entity.Instructor;
import edu.rice.evowl.mapper.providers.InstructorEvalSubmissionSqlProvider;
import org.apache.ibatis.annotations.InsertProvider;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface InstructorEvalSubmissionMapper {
    @InsertProvider(type = InstructorEvalSubmissionSqlProvider.class, method = "insertDynamic")
    void saveDynamicScoreRecord(InstructorEvalSubmission instructorEvalSubmission);
}
